package cloud.leneu.jaywiki.wiki;

import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.search.ArticleIndexEvent;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import cloud.leneu.jaywiki.wiki.asset.WikiAssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 위키 본문 CRUD + revision(버전 이력) 핵심 로직.
 *
 * 저장 규칙:
 *  - 신규: article INSERT (version=1)
 *  - 수정: ① 현재 본문을 public.tb_revision 에 스냅샷 → ② tb_article 을 새 내용 + version+1 로 UPDATE
 *  - 되돌리기: 과거 버전 내용으로 '새 수정'을 한 번 더 하는 것 (이력이 끊기지 않게)
 */
@Service
@RequiredArgsConstructor
public class ArticleService {

    private final WikiArticleRepository articleRepo;
    private final WikiRevisionRepository revisionRepo;
    private final WikiAssetService assetService;
    private final ApplicationEventPublisher events;

    public WikiArticle get(String slug) {
        return articleRepo.findById(slug)
                .orElseThrow(() -> new NotFoundException("article not found: " + slug));
    }

    /** Compatibility for old ?view=true clients. Reads never increment analytics. */
    public WikiArticle view(String slug, String clientIp, String referer, String userAgent) {
        return get(slug);
    }

    public List<WikiArticle> byTab(String tabId) {
        return articleRepo.findForTab(tabId);
    }

    /** 많이 쓰인 태그 상위 n 개. 검색 화면의 추천 키워드가 쓴다. */
    @Transactional(readOnly = true)
    public List<TagCount> topTags(int limit) {
        return articleRepo.countTags(Math.max(1, Math.min(limit, 20))).stream()
                .map(row -> new TagCount((String) row[0], ((Number) row[1]).longValue()))
                .toList();
    }

    public record TagCount(String name, long count) {
    }

    /** 생성 또는 수정(upsert). 수정이면 직전 본문을 revision 에 남긴다. */
    @Transactional
    public WikiArticle save(ArticleSaveRequest req) {
        String editor = (req.editor() == null || req.editor().isBlank()) ? "admin" : req.editor();

        WikiArticle a = articleRepo.findById(req.slug()).orElse(null);

        if (a == null) {
            // 신규
            a = new WikiArticle();
            a.setSlug(req.slug());
            a.setVersion(1);
            a.setCreatedAt(OffsetDateTime.now());
        } else {
            // 수정 → 현재(직전) 상태를 revision 으로 스냅샷
            snapshot(a, editor);
            a.setVersion(a.getVersion() + 1);
        }

        a.setParentId(req.parentId());
        a.setTitle(req.title());
        a.setSummary(req.summary());
        a.setBody(req.body() == null ? "" : req.body());
        a.setKind(req.kind() == null ? "wiki" : req.kind());
        a.setStatus(req.status() == null ? "draft" : req.status());
        a.setTags(req.tags());
        a.setLastReview(req.lastReview());
        a.setTocEnabled(Boolean.TRUE.equals(req.tocEnabled()));
        if (req.sortOrder() != null) a.setSortOrder(req.sortOrder());
        a.setUpdatedAt(OffsetDateTime.now());
        if (a.getSyncedAt() == null) a.setSyncedAt(OffsetDateTime.now());
        // createdAt 은 위의 신규 분기에서만 넣는다. 수정 시 채우면 이미 존재하던 글의
        // 작성일이 "마지막으로 고친 날"로 바뀌므로, 백필하지 못한 글은 null 로 둔다.

        WikiArticle saved = articleRepo.save(a);
        assetService.attachReferenced(saved.getBody());
        events.publishEvent(new ArticleIndexEvent(saved.getSlug(), ArticleIndexEvent.Action.UPSERT));
        return saved;
    }

    @Transactional
    public void delete(String slug) {
        if (!articleRepo.existsById(slug)) {
            throw new NotFoundException("article not found: " + slug);
        }
        articleRepo.deleteById(slug);
        events.publishEvent(new ArticleIndexEvent(slug, ArticleIndexEvent.Action.DELETE));
        // revision 은 이력 보존을 위해 남겨둠(원하면 같이 삭제 가능)
    }

    public List<WikiRevision> revisions(String slug) {
        return revisionRepo.findBySlugOrderByVersionDesc(slug);
    }

    public WikiRevision revision(String slug, int version) {
        return revisionRepo.findBySlugAndVersion(slug, version)
                .orElseThrow(() -> new NotFoundException("revision not found: " + slug + " v" + version));
    }

    /**
     * 되돌리기: 과거 버전의 title/body 로 '새 수정' 을 수행.
     * (article 을 통째로 과거로 바꾸되, 직전 상태도 revision 에 남아 이력이 이어짐)
     */
    @Transactional
    public WikiArticle revert(String slug, int version, String editor) {
        WikiArticle a = get(slug);
        WikiRevision target = revision(slug, version);

        snapshot(a, (editor == null || editor.isBlank()) ? "admin" : editor);
        a.setVersion(a.getVersion() + 1);
        a.setTitle(target.getTitle());
        a.setBody(target.getBody());
        a.setUpdatedAt(OffsetDateTime.now());
        WikiArticle saved = articleRepo.save(a);
        assetService.attachReferenced(saved.getBody());
        events.publishEvent(new ArticleIndexEvent(saved.getSlug(), ArticleIndexEvent.Action.UPSERT));
        return saved;
    }

    /** 현재 article 상태를 revision 테이블에 1행으로 복사. */
    private void snapshot(WikiArticle a, String editor) {
        WikiRevision r = new WikiRevision();
        r.setSlug(a.getSlug());
        r.setVersion(a.getVersion());   // '지금(=직전)' 버전 번호로 저장
        r.setTitle(a.getTitle());
        r.setBody(a.getBody());
        r.setEditor(editor);
        r.setCreatedAt(OffsetDateTime.now());
        revisionRepo.save(r);
    }
}
