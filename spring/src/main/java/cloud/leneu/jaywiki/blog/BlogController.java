package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import cloud.leneu.jaywiki.blog.dto.BlogPageSize;
import cloud.leneu.jaywiki.blog.dto.BlogPostPageQuery;
import cloud.leneu.jaywiki.blog.dto.PageResponse;
import cloud.leneu.jaywiki.blog.dto.BlogPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import cloud.leneu.jaywiki.blog.dto.BlogSearchHitDto;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.stats.SiteStatsService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 블로그 공개 조회. GET /api/** 는 SecurityConfig 에서 이미 공개다. */
@RestController
@RequestMapping("/api/blog")
@RequiredArgsConstructor
public class BlogController {

    private final BlogCategoryService categoryService;
    private final BlogPostService postService;
    private final BlogTagService tagService;
    private final cloud.leneu.jaywiki.stats.BrowserAnalyticsService analytics;

    @GetMapping("/categories")
    public List<BlogCategoryDto> categories() {
        return categoryService.tree();
    }

    /**
     * 전체 목록. 페이지로 자르지 않는다 -- 사이트맵이 모든 글의 주소를 필요로 하고,
     * 공유 카드가 조회수를 안 올리려고 여기서 글을 찾는다. 화면용은 아래 /posts/page 다.
     */
    @GetMapping("/posts")
    public List<BlogPostSummaryDto> posts() {
        return postService.published();
    }

    /**
     * 화면이 쓰는 목록. 전체·카테고리·태그가 조건만 바꿔 같은 경로를 쓴다.
     * size 는 허용값(10·30·50) 밖이면 기본값으로 떨어진다 -- BlogPageSize 참고.
     */
    @GetMapping("/posts/page")
    public PageResponse<BlogPostSummaryDto> postsPage(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return postService.page(BlogPostPageQuery.of(category, tag, page, size));
    }

    /** 레일의 '인기 글'. 화면은 3편만 쓰지만 기본 5편을 준다. */
    /** 제목·요약·본문 검색. 두 글자 미만이면 서비스가 빈 목록을 준다. */
    @GetMapping("/search")
    public List<BlogSearchHitDto> search(@RequestParam(defaultValue = "") String q) {
        return postService.search(q);
    }

    /** 검색 화면이 쓰는 페이지 판. 목록과 같은 껍데기로 준다. */
    @GetMapping("/search/page")
    public PageResponse<BlogSearchHitDto> searchPage(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return postService.searchPage(q, page == null ? 1 : page, BlogPageSize.of(size));
    }

    @GetMapping("/posts/popular")
    public List<BlogPostSummaryDto> popular(@RequestParam(defaultValue = "5") int limit) {
        if (limit < 1 || limit > 20) {
            throw new BadRequestException("limit must be between 1 and 20: " + limit);
        }
        return postService.popular(limit);
    }

    @GetMapping("/categories/{slug}/posts")
    public List<BlogPostSummaryDto> byCategory(@PathVariable String slug) {
        return postService.byCategory(slug);
    }

    @GetMapping("/posts/{id}")
    public BlogPostDto post(@PathVariable Long id, HttpServletRequest request) {
        BlogPostDto found = postService.get(id);
        return found;
    }

    @GetMapping("/posts/{id}/neighbors")
    public BlogPostService.Neighbors neighbors(@PathVariable Long id) {
        return postService.neighbors(id);
    }

    @GetMapping("/tags")
    public List<BlogTagService.TagCount> tags() {
        return tagService.counts();
    }

    @GetMapping("/tags/{name}/posts")
    public List<BlogPostSummaryDto> byTag(@PathVariable String name) {
        return postService.publishedByTag(name);
    }

    /** 방문자·조회수 집계. 개별 식별자가 없는 숫자뿐이라 공개해도 된다. */
    @GetMapping("/stats")
    public SiteStatsService.Summary stats() {
        return analytics.publicSummary(SiteStatsService.BLOG);
    }
}
