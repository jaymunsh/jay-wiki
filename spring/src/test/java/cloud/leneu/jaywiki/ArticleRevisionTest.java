package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.wiki.ArticleService;
import cloud.leneu.jaywiki.wiki.TabService;
import cloud.leneu.jaywiki.wiki.WikiArticle;
import cloud.leneu.jaywiki.wiki.WikiArticleRepository;
import cloud.leneu.jaywiki.wiki.WikiRevision;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import cloud.leneu.jaywiki.wiki.dto.ArticleSummaryDto;
import cloud.leneu.jaywiki.wiki.dto.TabSaveRequest;
import cloud.leneu.jaywiki.wiki.dto.TabDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.List;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 본문 CRUD + revision 메커니즘 검증 (실제 PG, Testcontainers).
 * 시연 핵심: 수정 시 직전 본문이 revision 에 쌓이고, 되돌리기가 동작한다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ArticleRevisionTest {

    @Autowired ArticleService service;
    @Autowired TabService tabService;
    @Autowired WikiArticleRepository articleRepo;

    private ArticleSaveRequest req(String slug, String title, String body) {
        return new ArticleSaveRequest(slug, "data", title, "요약", body, "wiki", "published", null, null, 0, "admin");
    }

    @Test
    void 생성_수정_시_버전과_이력이_쌓인다() {
        // v1 생성
        WikiArticle v1 = service.save(req("redis-rev", "제목1", "본문1"));
        assertThat(v1.getVersion()).isEqualTo(1);
        assertThat(service.revisions("redis-rev")).isEmpty();   // 아직 이력 없음

        // v2 수정 → 직전(v1) 이 revision 에 스냅샷
        WikiArticle v2 = service.save(req("redis-rev", "제목2", "본문2"));
        assertThat(v2.getVersion()).isEqualTo(2);
        List<WikiRevision> revs = service.revisions("redis-rev");
        assertThat(revs).hasSize(1);
        assertThat(revs.get(0).getVersion()).isEqualTo(1);
        assertThat(revs.get(0).getBody()).isEqualTo("본문1");

        // v3 수정
        service.save(req("redis-rev", "제목3", "본문3"));
        assertThat(service.revisions("redis-rev")).hasSize(2);   // v1, v2 이력
    }

    @Test
    void 목록_요약은_문서의_발행_시각과_마지막_수정_시각을_포함한다() {
        WikiArticle article = service.save(req("summary-timestamp", "타임스탬프", "본문"));

        ArticleSummaryDto summary = ArticleSummaryDto.from(article);

        assertThat(summary.createdAt()).isEqualTo(article.getCreatedAt());
        assertThat(summary.updatedAt()).isEqualTo(article.getUpdatedAt());
    }

    @Test
    void 탭_문서는_발행일이_sortOrder보다_우선한다() {
        String tabId = "recent-order";
        tabService.save(new TabSaveRequest(tabId, "최근 문서", 99));
        // sortOrder 가 앞선 글이라도 먼저 발행됐으면 아래로 내려간다.
        WikiArticle low = service.save(new ArticleSaveRequest(
                "low-sort-old", tabId, "앞 순번인데 오래된 글", "요약", "본문", "wiki", "published", null, null, 0, "admin"));
        WikiArticle high = service.save(new ArticleSaveRequest(
                "high-sort-new", tabId, "뒤 순번인데 최근 글", "요약", "본문", "wiki", "published", null, null, 1, "admin"));
        low.setCreatedAt(OffsetDateTime.parse("2026-07-10T00:00:00Z"));
        high.setCreatedAt(OffsetDateTime.parse("2026-07-11T00:00:00Z"));
        articleRepo.saveAll(List.of(low, high));

        TabDto tab = tabService.tree().stream().filter(item -> item.tabId().equals(tabId)).findFirst().orElseThrow();

        assertThat(tab.articles()).extracting(ArticleSummaryDto::slug)
                .containsExactly("high-sort-new", "low-sort-old");
    }

    @Test
    void 발행_시각이_같으면_sortOrder_오름차순으로_가른다() {
        String tabId = "same-instant";
        tabService.save(new TabSaveRequest(tabId, "동시각 문서", 97));
        WikiArticle later = service.save(new ArticleSaveRequest(
                "same-second", tabId, "뒤 순번", "요약", "본문", "wiki", "published", null, null, 1, "admin"));
        WikiArticle earlier = service.save(new ArticleSaveRequest(
                "same-first", tabId, "앞 순번", "요약", "본문", "wiki", "published", null, null, 0, "admin"));
        OffsetDateTime sameInstant = OffsetDateTime.parse("2026-07-12T00:00:00Z");
        later.setCreatedAt(sameInstant);
        earlier.setCreatedAt(sameInstant);
        articleRepo.saveAll(List.of(later, earlier));

        TabDto tab = tabService.tree().stream().filter(item -> item.tabId().equals(tabId)).findFirst().orElseThrow();

        assertThat(tab.articles()).extracting(ArticleSummaryDto::slug)
                .containsExactly("same-first", "same-second");
    }

    @Test
    void 대시보드_탭은_sortOrder가_발행일보다_우선한다() {
        // start 는 첫 화면이라 '한눈에 보기'가 항상 맨 위여야 한다.
        // 나중에 발행한 글이 생겨도 입구가 바뀌면 안 된다.
        tabService.save(new TabSaveRequest("start", "대시보드", 0));
        WikiArticle entry = service.save(new ArticleSaveRequest(
                "start-entry", "start", "한눈에 보기", "요약", "본문", "wiki", "published", null, null, 0, "admin"));
        WikiArticle recent = service.save(new ArticleSaveRequest(
                "start-recent", "start", "나중에 쓴 글", "요약", "본문", "wiki", "published", null, null, 1, "admin"));
        entry.setCreatedAt(OffsetDateTime.parse("2026-07-10T00:00:00Z"));
        recent.setCreatedAt(OffsetDateTime.parse("2026-08-10T00:00:00Z"));
        articleRepo.saveAll(List.of(entry, recent));

        TabDto tab = tabService.tree().stream().filter(item -> item.tabId().equals("start")).findFirst().orElseThrow();

        assertThat(tab.articles()).extracting(ArticleSummaryDto::slug)
                .containsExactly("start-entry", "start-recent");
    }

    @Test
    void sortOrder가_같으면_발행_최신순으로_정렬한다() {
        String tabId = "tie-order";
        tabService.save(new TabSaveRequest(tabId, "동률 문서", 98));
        WikiArticle older = service.save(new ArticleSaveRequest(
                "tie-older", tabId, "이전 문서", "요약", "본문", "wiki", "published", null, null, 5, "admin"));
        WikiArticle newer = service.save(new ArticleSaveRequest(
                "tie-newer", tabId, "최신 문서", "요약", "본문", "wiki", "published", null, null, 5, "admin"));
        older.setCreatedAt(OffsetDateTime.parse("2026-07-10T00:00:00Z"));
        newer.setCreatedAt(OffsetDateTime.parse("2026-07-11T00:00:00Z"));
        articleRepo.saveAll(List.of(older, newer));

        TabDto tab = tabService.tree().stream().filter(item -> item.tabId().equals(tabId)).findFirst().orElseThrow();

        assertThat(tab.articles()).extracting(ArticleSummaryDto::slug)
                .containsExactly("tie-newer", "tie-older");
    }

    @Test
    void 검색_fallback은_제목_일치를_본문_일치보다_먼저_돌려준다() {
        // 예전 정렬 기준이던 lastReview 를 일부러 동률로 두고, 그래도 순서가 결정되는지 본다.
        WikiArticle bodyOnly = service.save(new ArticleSaveRequest(
                "fallback-body", "data", "관계없는 제목", "요약", "여기 본문에만 outbox 라는 말이 있다",
                "wiki", "published", null, null, 0, "admin"));
        WikiArticle titleHit = service.save(new ArticleSaveRequest(
                "fallback-title", "data", "outbox 패턴 정리", "요약", "본문에는 없다",
                "wiki", "published", null, null, 1, "admin"));
        // 본문 일치 문서를 더 최근에 수정해도 제목 일치 문서가 앞에 와야 한다.
        titleHit.setUpdatedAt(OffsetDateTime.parse("2026-07-10T00:00:00Z"));
        bodyOnly.setUpdatedAt(OffsetDateTime.parse("2026-07-11T00:00:00Z"));
        articleRepo.saveAll(List.of(titleHit, bodyOnly));

        assertThat(articleRepo.search("outbox")).extracting(WikiArticle::getSlug)
                .containsExactly("fallback-title", "fallback-body");
    }

    @Test
    void 검색_fallback은_같은_조건이면_매번_같은_순서를_돌려준다() {
        WikiArticle a = service.save(new ArticleSaveRequest(
                "stable-b", "data", "정렬 안정성 b", "요약", "본문", "wiki", "published", null, null, 0, "admin"));
        WikiArticle b = service.save(new ArticleSaveRequest(
                "stable-a", "data", "정렬 안정성 a", "요약", "본문", "wiki", "published", null, null, 1, "admin"));
        // 제목 일치도 수정 시각도 동률이면 slug 로 끊는다.
        OffsetDateTime same = OffsetDateTime.parse("2026-07-10T00:00:00Z");
        a.setUpdatedAt(same);
        b.setUpdatedAt(same);
        articleRepo.saveAll(List.of(a, b));

        assertThat(articleRepo.search("정렬 안정성")).extracting(WikiArticle::getSlug)
                .containsExactly("stable-a", "stable-b");
    }

    @Test
    void 작성일은_처음_저장할_때만_기록되고_수정해도_바뀌지_않는다() {
        service.save(req("created-at-doc", "원본", "원본본문"));
        OffsetDateTime created = service.get("created-at-doc").getCreatedAt();
        assertThat(created).isNotNull();

        service.save(req("created-at-doc", "수정", "수정본문"));
        WikiArticle updated = service.get("created-at-doc");

        assertThat(updated.getCreatedAt()).isEqualTo(created);
        assertThat(updated.getUpdatedAt()).isAfterOrEqualTo(created);
    }

    @Test
    void 되돌리기는_과거_내용으로_새_버전을_만든다() {
        service.save(req("revert-doc", "원본", "원본본문"));      // v1
        service.save(req("revert-doc", "수정", "수정본문"));      // v2 (v1 스냅샷)

        // v1 로 되돌리기 → v3 가 되며 내용은 v1
        WikiArticle reverted = service.revert("revert-doc", 1, "admin");
        assertThat(reverted.getVersion()).isEqualTo(3);
        assertThat(reverted.getBody()).isEqualTo("원본본문");
        assertThat(service.get("revert-doc").getTitle()).isEqualTo("원본");
    }
}
