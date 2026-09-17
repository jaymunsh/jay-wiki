package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import cloud.leneu.jaywiki.blog.dto.BlogSearchHitDto;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.wiki.asset.WikiAssetService;
import lombok.RequiredArgsConstructor;
import cloud.leneu.jaywiki.blog.dto.BlogPageSize;
import cloud.leneu.jaywiki.blog.dto.BlogPostPageQuery;
import cloud.leneu.jaywiki.blog.dto.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BlogPostService {

    private static final String PUBLISHED = "published";
    private static final String DRAFT = "draft";

    private final BlogPostRepository posts;
    private final BlogCategoryRepository categories;
    private final BlogCategoryService categoryService;
    private final BlogTagService tagService;
    private final WikiAssetService assetService;

    /** 이전 글과 다음 글. 없으면 null 이다. */
    public record Neighbors(BlogPostSummaryDto prev, BlogPostSummaryDto next) {
    }

    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> published() {
        return toSummaries(posts.findByStatusOrderByPublishedAtDescIdDesc(PUBLISHED));
    }

    /**
     * 전체·카테고리·태그 목록을 조건만 바꿔 한 자리에서 준다. 셋 다 "조건에 맞는 발행 글을
     * 페이지 단위로" 라는 같은 요청이라, 화면마다 전체를 받아 잘라 쓰던 것을 여기로 모았다.
     *
     * 카테고리와 태그를 같이 주면 카테고리를 쓴다. 둘을 동시에 거는 화면이 아직 없어서,
     * 교집합 질의를 미리 만들어 두지 않았다.
     */
    @Transactional(readOnly = true)
    public PageResponse<BlogPostSummaryDto> page(BlogPostPageQuery query) {
        Map<Long, BlogCategory> byId = categoryIndex();
        Page<BlogPost> found = findPage(query);
        return PageResponse.of(found, query.size(), p -> toSummary(p, byId));
    }

    private Page<BlogPost> findPage(BlogPostPageQuery query) {
        if (query.categorySlug() != null) {
            BlogCategory category = categoryService.bySlug(query.categorySlug());
            return posts.findByCategoryIdAndStatusOrderByPublishedAtDescIdDesc(
                    category.getId(), PUBLISHED, query.pageable());
        }
        if (query.tagName() != null) {
            return posts.findPublishedByTagName(query.tagName(), query.pageable());
        }
        return posts.findByStatusOrderByPublishedAtDescIdDesc(PUBLISHED, query.pageable());
    }

    /** 태그 하나에 달린 published 글. 조인 질의 한 번으로 끝낸다. */
    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> publishedByTag(String tagName) {
        return toSummaries(posts.findPublishedByTagName(tagName));
    }

    /** 레일의 '인기 글'. 조회수 기준이며 limit 범위 검사는 컨트롤러가 한다. */
    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> popular(int limit) {
        return toSummaries(posts.findPopular(PageRequest.of(0, limit)));
    }

    /** 검색어의 최소 길이. 한 글자면 거의 모든 글이 걸려 목록과 다를 바가 없다. */
    public static final int MIN_QUERY_LENGTH = 2;

    /**
     * 제목·요약·본문 검색. 짧은 질의는 아예 찾지 않고 빈 목록을 준다.
     * 검색어의 LIKE 특수문자(%, _, 역슬래시)는 글자 그대로 찾도록 escape 한다.
     */
    @Transactional(readOnly = true)
    public List<BlogSearchHitDto> search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < MIN_QUERY_LENGTH) return List.of();

        Map<Long, BlogCategory> byId = categoryIndex();
        return posts.searchPublished(escapeLike(q)).stream()
                .map(post -> toHit(post, q, byId))
                .toList();
    }

    /** 검색의 페이지 판. 짧은 질의는 빈 1 페이지를 준다 -- 전체 목록과 같은 규칙이다. */
    @Transactional(readOnly = true)
    public PageResponse<BlogSearchHitDto> searchPage(String query, int page, BlogPageSize size) {
        String q = query == null ? "" : query.trim();
        if (q.length() < MIN_QUERY_LENGTH) {
            return new PageResponse<>(List.of(), 1, size.value(), 0, 1);
        }
        Map<Long, BlogCategory> byId = categoryIndex();
        BlogPostPageQuery paging = new BlogPostPageQuery(null, null, page, size);
        Page<BlogPost> found = posts.searchPublished(escapeLike(q), paging.pageable());
        return PageResponse.of(found, size, post -> toHit(post, q, byId));
    }

    private static String escapeLike(String q) {
        return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private BlogSearchHitDto toHit(BlogPost post, String query, Map<Long, BlogCategory> byId) {
        BlogCategory category = byId.get(post.getCategoryId());
        return new BlogSearchHitDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(),
                category == null ? null : category.getSlug(),
                category == null ? null : category.getName(),
                BlogCoverImage.resolve(post.getCoverAssetId(), post.getBody()),
                post.getPublishedAt(), post.getUpdatedAt(),
                BlogSearchSnippet.of(post.getBody(), query));
    }

    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> byCategory(String categorySlug) {
        BlogCategory category = categoryService.bySlug(categorySlug);
        return toSummaries(posts.findByCategoryIdAndStatusOrderByPublishedAtDescIdDesc(category.getId(), PUBLISHED));
    }

    @Transactional(readOnly = true)
    public BlogPostDto get(Long id) {
        BlogPost post = posts.findByIdAndStatus(id, PUBLISHED)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        BlogCategory category = categories.findById(post.getCategoryId())
                .orElseThrow(() -> new NotFoundException("blog category not found: " + post.getCategoryId()));
        return new BlogPostDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(), post.getBody(),
                category.getSlug(), category.getName(),
                BlogCoverImage.resolve(post.getCoverAssetId(), post.getBody()),
                post.getPublishedAt(), post.getUpdatedAt(), post.isTocEnabled(),
                tagService.namesOf(post.getId()),
                seriesLink(post.getPrevPostId()), seriesLink(post.getNextPostId()));
    }

    /**
     * 시리즈로 이어진 글의 한 줄 요약. 상세 응답에 함께 실어 화면이 따로 부르지 않게 한다.
     * 아직 발행 전이거나 지워진 글이면 null 이고, 화면은 그 칸을 안 그린다.
     */
    private BlogPostSummaryDto seriesLink(Long id) {
        if (id == null) return null;
        return posts.findByIdAndStatus(id, PUBLISHED)
                .map(p -> toSummary(p, categoryIndex()))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public Neighbors neighbors(Long id) {
        BlogPost post = posts.findByIdAndStatus(id, PUBLISHED)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        Map<Long, BlogCategory> byId = categoryIndex();
        BlogPostSummaryDto prev = posts.findPrev(post.getPublishedAt(), post.getId())
                .stream().findFirst().map(p -> toSummary(p, byId)).orElse(null);
        BlogPostSummaryDto next = posts.findNext(post.getPublishedAt(), post.getId())
                .stream().findFirst().map(p -> toSummary(p, byId)).orElse(null);
        return new Neighbors(prev, next);
    }

    /** 관리 목록. draft 를 포함한다. */
    @Transactional(readOnly = true)
    public List<BlogAdminPostDto> adminList() {
        Map<Long, BlogCategory> byId = categoryIndex();
        return posts.findAllForAdmin().stream().map(p -> toAdminDto(p, byId)).toList();
    }

    /** 관리 단건. 조회수를 올리지 않는다 — 열어볼 때마다 오르면 통계가 망가진다. */
    @Transactional(readOnly = true)
    public BlogAdminPostDto adminGet(Long id) {
        BlogPost post = posts.findById(id)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        return toAdminDto(post, categoryIndex());
    }

    @Transactional
    public BlogAdminPostDto create(BlogPostSaveRequest request) {
        BlogPost post = new BlogPost();
        post.setCreatedAt(OffsetDateTime.now());
        return save(post, request);
    }

    @Transactional
    public BlogAdminPostDto update(Long id, BlogPostSaveRequest request) {
        BlogPost post = posts.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        BlogAdminPostDto current = toAdminDto(post, categoryIndex());
        if (unchanged(post, current, request)) return current;
        return save(post, request);
    }

    /**
     * 아무것도 안 바뀐 저장은 하지 않는다. 초안 전부를 한꺼번에 올리는 발행 스크립트가 있어서
     * (scripts/publish-blog-drafts.mjs), 그냥 저장하면 손대지 않은 글까지 updatedAt 이 오늘로 튀고
     * 화면에 없던 '수정됨' 이 붙는다. 배포의 내부 싱크는 이미 걸러 왔다 -- 그 판단을 여기로 모은다.
     *
     * same() 은 본문·제목·태그만 본다. 상태와 발행일은 거기 없으므로 여기서 따로 견준다.
     * 빠뜨리면 공개/비공개 전환과 발행일만 고치는 저장이 조용히 안 먹는다.
     */
    private boolean unchanged(BlogPost post, BlogAdminPostDto current, BlogPostSaveRequest request) {
        String requestStatus = PUBLISHED.equals(request.status()) ? PUBLISHED : DRAFT;
        return requestStatus.equals(post.getStatus())
                && Objects.equals(post.getPrevPostId(), request.prevPostId())
                && Objects.equals(post.getNextPostId(), request.nextPostId())
                && (request.publishedAt() == null
                    || (post.getPublishedAt() != null && request.publishedAt().isEqual(post.getPublishedAt())))
                && BlogContentSyncService.same(current, request);
    }

    @Transactional
    public void delete(Long id) {
        if (!posts.existsById(id)) {
            throw new NotFoundException("blog post not found: " + id);
        }
        // 댓글과 태그 연결은 on delete cascade 로 함께 사라진다(V13).
        posts.deleteById(id);
    }

    private BlogAdminPostDto save(BlogPost post, BlogPostSaveRequest request) {
        if (request.title() == null || request.title().isBlank()) {
            throw new BadRequestException("title is required");
        }
        if (request.body() == null || request.body().isBlank()) {
            throw new BadRequestException("body is required");
        }
        String status = PUBLISHED.equals(request.status()) ? PUBLISHED : DRAFT;
        BlogCategory category = categories.findById(request.categoryId() == null ? -1L : request.categoryId())
                .orElseThrow(() -> new NotFoundException("blog category not found: " + request.categoryId()));

        post.setSlug(request.slug() == null || request.slug().isBlank()
                ? "post-" + OffsetDateTime.now().toEpochSecond() : request.slug().trim());
        post.setTitle(request.title().trim());
        post.setSummary(request.summary());
        post.setBody(request.body());
        post.setCategoryId(category.getId());
        post.setCoverAssetId(request.coverAssetId());
        // null 은 '안 건드림'이다. 목차 필드를 안 보내는 옛 호출부가 값을 끄지 않게 한다.
        if (request.tocEnabled() != null) post.setTocEnabled(request.tocEnabled());
        post.setStatus(status);
        // published 인데 발행일이 비면 지금 시각을 넣는다.
        // 넣지 않으면 V13 의 CHECK 제약 위반이 그대로 500 으로 나간다.
        //
        // 다만 '요청에 없다' 와 '비어 있다' 는 다르다. 발행일을 안 보내는 호출부가 있고
        // (배포의 내부 콘텐츠 싱크), 거기서 지금 시각으로 덮으면 배포로 글을 고칠 때마다
        // 발행일이 그날로 밀린다. 이미 있는 값을 먼저 쓰고, 그것도 없을 때만 지금 시각이다.
        OffsetDateTime keptPublishedAt = request.publishedAt() != null ? request.publishedAt()
                : post.getPublishedAt() != null ? post.getPublishedAt()
                : OffsetDateTime.now();
        post.setPublishedAt(PUBLISHED.equals(status) ? keptPublishedAt : request.publishedAt());
        // 발행일과 같은 규칙이다. 요청에 있으면 그것이 정본이고, 없을 때만 지금 시각이다.
        post.setUpdatedAt(request.updatedAt() != null ? request.updatedAt() : OffsetDateTime.now());

        BlogPost saved = posts.save(post);
        applySeriesLinks(saved, request.prevPostId(), request.nextPostId());
        tagService.attach(saved.getId(), request.tags() == null ? List.of() : request.tags());
        // 본문이 참조하는 자산을 TEMP 에서 떼어낸다. 이걸 빠뜨리면 TEMP 정리 작업이
        // 생기는 순간 블로그 이미지가 쓸려나간다(관리자 설계 5절).
        assetService.attachReferenced(saved.getBody());
        return adminGet(saved.getId());
    }

    /**
     * 시리즈 연결을 양쪽에 함께 쓴다. 37 에 "앞선 글 = 22" 를 적으면 22 의 "이어지는 글" 도 37 이 된다.
     * 한쪽만 쓰면 두 글이 서로 다른 말을 하게 되는데, 그 어긋남은 화면에서 알아볼 방법이 없다.
     * 그래서 어느 쪽에서 적든 결과가 같도록 여기서 맞춘다.
     *
     * 저장이 끝난 뒤에 부른다. 새 글은 이 시점에야 id 가 있다.
     */
    private void applySeriesLinks(BlogPost post, Long prevId, Long nextId) {
        Long me = post.getId();
        if (me.equals(prevId) || me.equals(nextId)) {
            throw new BadRequestException("series link cannot point to itself");
        }
        if (prevId != null && prevId.equals(nextId)) {
            throw new BadRequestException("prev and next must be different posts");
        }

        releaseOld(post.getPrevPostId(), prevId, me, false);
        releaseOld(post.getNextPostId(), nextId, me, true);

        post.setPrevPostId(prevId);
        post.setNextPostId(nextId);
        posts.save(post);

        pointBack(prevId, me, false);
        pointBack(nextId, me, true);
    }

    /**
     * 떨어져 나가는 옛 상대에서 나를 가리키던 링크를 끊는다.
     * 나를 안 가리키고 있으면 남의 연결이므로 건드리지 않는다.
     */
    private void releaseOld(Long oldId, Long newId, Long me, boolean oldWasMyNext) {
        if (oldId == null || oldId.equals(newId)) return;
        posts.findById(oldId).ifPresent(old -> {
            if (oldWasMyNext && me.equals(old.getPrevPostId())) {
                old.setPrevPostId(null);
                posts.save(old);
            } else if (!oldWasMyNext && me.equals(old.getNextPostId())) {
                old.setNextPostId(null);
                posts.save(old);
            }
        });
    }

    /**
     * 새 상대의 반대편을 나로 맞춘다. 그 자리에 있던 제3자는 밀려나므로 그쪽 링크도 함께 끊는다.
     * 안 끊으면 제3자만 옛 상대를 가리킨 채 남아 한 방향만 이어진 글이 생긴다.
     */
    private void pointBack(Long otherId, Long me, boolean otherIsMyNext) {
        if (otherId == null) return;
        BlogPost other = posts.findById(otherId)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + otherId));
        Long displaced = otherIsMyNext ? other.getPrevPostId() : other.getNextPostId();
        if (displaced != null && !displaced.equals(me)) {
            posts.findById(displaced).ifPresent(third -> {
                if (otherIsMyNext && otherId.equals(third.getNextPostId())) {
                    third.setNextPostId(null);
                    posts.save(third);
                } else if (!otherIsMyNext && otherId.equals(third.getPrevPostId())) {
                    third.setPrevPostId(null);
                    posts.save(third);
                }
            });
        }
        if (otherIsMyNext) other.setPrevPostId(me);
        else other.setNextPostId(me);
        posts.save(other);
    }

    private BlogAdminPostDto toAdminDto(BlogPost post, Map<Long, BlogCategory> byId) {
        BlogCategory category = byId.get(post.getCategoryId());
        return new BlogAdminPostDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(), post.getBody(),
                post.getCategoryId(),
                category == null ? null : category.getSlug(),
                category == null ? null : category.getName(),
                post.getCoverAssetId(), post.getStatus(), post.getPublishedAt(),
                post.getUpdatedAt(), post.getViewCount(), post.isTocEnabled(),
                tagService.namesOf(post.getId()),
                post.getPrevPostId(), post.getNextPostId());
    }

    private List<BlogPostSummaryDto> toSummaries(List<BlogPost> found) {
        Map<Long, BlogCategory> byId = categoryIndex();
        return found.stream().map(p -> toSummary(p, byId)).toList();
    }

    /** 목록마다 카테고리를 한 번에 읽어 N+1 을 만들지 않는다. */
    private Map<Long, BlogCategory> categoryIndex() {
        return categories.findAll().stream()
                .collect(Collectors.toMap(BlogCategory::getId, Function.identity()));
    }

    private BlogPostSummaryDto toSummary(BlogPost post, Map<Long, BlogCategory> byId) {
        BlogCategory category = byId.get(post.getCategoryId());
        return new BlogPostSummaryDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(),
                category == null ? null : category.getSlug(),
                category == null ? null : category.getName(),
                BlogCoverImage.resolve(post.getCoverAssetId(), post.getBody()),
                post.getPublishedAt(), post.getUpdatedAt());
    }
}
