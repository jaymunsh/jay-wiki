package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogPageSize;
import cloud.leneu.jaywiki.blog.dto.BlogPostPageQuery;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import cloud.leneu.jaywiki.blog.dto.BlogSearchHitDto;
import cloud.leneu.jaywiki.blog.dto.PageResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 목록 페이징의 규칙을 고정한다. 지키려는 것은 셋이다 --
 * 자르는 자리가 DB 로 내려가도 화면이 보던 순서가 같을 것, 총 편수는 페이지 길이가 아니라
 * 전체 건수일 것, 그리고 size 를 열어 두어 전체를 한 번에 긁는 길을 만들지 않을 것.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogPostPagingTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostService postService;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;

    private static final String SLUG_PREFIX = "paging-";
    private static final int TOTAL = 12;

    @BeforeEach
    void setUp() {
        clean();
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        // 발행일을 하루씩 벌려 순서를 확정한다. 같은 시각이면 정렬이 id 로 흔들려 경계 검증이 흐려진다.
        for (int i = 0; i < TOTAL; i++) {
            jdbc.update("""
                    insert into public.tb_blog_post
                      (slug, title, summary, body, category_id, status, published_at, updated_at, view_count, toc_enabled)
                    values (?, ?, ?, ?, ?, 'published', ?, now(), 0, true)
                    """,
                    SLUG_PREFIX + i, "페이징 " + i, "요약 " + i, "본문 페이징검증어 " + i, categoryId,
                    OffsetDateTime.parse("2026-01-01T00:00:00Z").plusDays(i));
        }
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        jdbc.update("delete from public.tb_blog_post where slug like ?", SLUG_PREFIX + "%");
    }

    private PageResponse<BlogPostSummaryDto> page(int page, BlogPageSize size) {
        return postService.page(new BlogPostPageQuery(null, null, page, size));
    }

    /** 이 저장소에는 시드 글이 함께 있으므로, 검증은 이번에 넣은 글만 골라서 한다. */
    private long mineIn(PageResponse<BlogPostSummaryDto> response) {
        return response.items().stream().filter(p -> p.slug().startsWith(SLUG_PREFIX)).count();
    }

    @Test
    void 첫_페이지는_size_만큼만_준다() {
        PageResponse<BlogPostSummaryDto> first = page(1, BlogPageSize.TEN);
        assertThat(first.items()).hasSize(10);
        assertThat(first.page()).isEqualTo(1);
        assertThat(first.size()).isEqualTo(10);
    }

    @Test
    void 총_편수는_페이지_길이가_아니라_전체_건수다() {
        PageResponse<BlogPostSummaryDto> first = page(1, BlogPageSize.TEN);
        assertThat(first.total()).isGreaterThanOrEqualTo(TOTAL);
        assertThat(first.total()).isGreaterThan(first.items().size());
        assertThat(first.totalPages()).isEqualTo((int) Math.ceil(first.total() / 10.0));
    }

    @Test
    void 페이지를_넘겨도_같은_글이_두_번_나오지_않는다() {
        var firstIds = page(1, BlogPageSize.TEN).items().stream().map(BlogPostSummaryDto::id).toList();
        var secondIds = page(2, BlogPageSize.TEN).items().stream().map(BlogPostSummaryDto::id).toList();
        assertThat(firstIds).doesNotContainAnyElementsOf(secondIds);
    }

    @Test
    void 범위를_벗어난_페이지는_빈_목록이다() {
        PageResponse<BlogPostSummaryDto> far = page(9999, BlogPageSize.FIFTY);
        assertThat(far.items()).isEmpty();
        assertThat(far.total()).isGreaterThan(0);
    }

    @Test
    void 페이지_번호는_1부터_센다() {
        // Spring Data 는 0 부터 세므로 경계에서 한 번 변환한다. 0 이나 음수가 와도 1 페이지로 본다.
        assertThat(page(1, BlogPageSize.TEN).items())
                .isEqualTo(page(0, BlogPageSize.TEN).items());
    }

    @Test
    void 허용하지_않는_size_는_기본값으로_떨어진다() {
        assertThat(BlogPageSize.of(100_000)).isEqualTo(BlogPageSize.DEFAULT);
        assertThat(BlogPageSize.of(null)).isEqualTo(BlogPageSize.DEFAULT);
        assertThat(BlogPageSize.of(7)).isEqualTo(BlogPageSize.DEFAULT);
        assertThat(BlogPageSize.of(50)).isEqualTo(BlogPageSize.FIFTY);
    }

    @Test
    void 카테고리로_거른_목록도_같은_껍데기로_온다() {
        PageResponse<BlogPostSummaryDto> response =
                postService.page(new BlogPostPageQuery("tech-lab", null, 1, BlogPageSize.TEN));
        assertThat(response.items()).hasSize(10);
        assertThat(response.items()).allMatch(p -> "tech-lab".equals(p.categorySlug()));
        assertThat(mineIn(response)).isGreaterThan(0);
    }

    @Test
    void 전체_목록_API_는_페이지로_자르지_않는다() {
        // 사이트맵과 공유 카드가 이 응답을 쓴다. 여기가 잘리면 둘 다 조용히 망가진다.
        assertThat(postService.published().size()).isGreaterThan(BlogPageSize.TEN.value());
    }

    @Test
    void 검색도_페이지로_자른다() {
        PageResponse<BlogSearchHitDto> first = postService.searchPage("페이징검증어", 1, BlogPageSize.TEN);
        assertThat(first.items()).hasSize(10);
        assertThat(first.total()).isEqualTo(TOTAL);
        assertThat(postService.searchPage("페이징검증어", 2, BlogPageSize.TEN).items()).hasSize(2);
    }

    @Test
    void HTTP_경로도_같은_껍데기로_응답한다() throws Exception {
        // 서비스가 통과해도 직렬화나 파라미터 바인딩에서 깨질 수 있어 경로까지 한 번 탄다.
        mvc.perform(get("/api/blog/posts/page").param("page", "1").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(10))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalPages").isNumber());

        mvc.perform(get("/api/blog/posts/page").param("category", "tech-lab"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(30));

        mvc.perform(get("/api/blog/search/page").param("q", "페이징검증어").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(TOTAL));
    }

    @Test
    void 파라미터가_없어도_기본값으로_응답한다() throws Exception {
        mvc.perform(get("/api/blog/posts/page"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(30));
    }

    @Test
    void 짧은_검색어는_빈_1페이지다() {
        PageResponse<BlogSearchHitDto> response = postService.searchPage("가", 1, BlogPageSize.THIRTY);
        assertThat(response.items()).isEmpty();
        assertThat(response.total()).isZero();
        assertThat(response.totalPages()).isEqualTo(1);
    }

    /**
     * 발행일이 같은 글은 나중에 올린 것이 위에 온다.
     *
     * 실제로 그런 글이 생긴다 -- 초안 머리말에 발행일을 자정으로 손수 적으면 같은 날 올린
     * 글끼리 값이 정확히 같아진다. 2026-09-04 에 두 편이 그랬고, 나중에 올린 글이 아래로
     * 갔다. 기준이 publishedAt 하나뿐이면 순서를 DB 가 정하기 때문이다.
     */
    @Test
    void 발행일이_같으면_나중에_올린_글이_위에_온다() {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        OffsetDateTime sameMoment = OffsetDateTime.parse("2027-01-01T00:00:00Z");
        for (int i = 0; i < 3; i++) {
            jdbc.update("""
                    insert into public.tb_blog_post
                      (slug, title, summary, body, category_id, status, published_at, updated_at, view_count, toc_enabled)
                    values (?, ?, ?, ?, ?, 'published', ?, now(), 0, true)
                    """,
                    SLUG_PREFIX + "tie-" + i, "동점 " + i, "요약", "본문 페이징검증어", categoryId, sameMoment);
        }

        List<String> slugs = postService.published().stream()
                .map(BlogPostSummaryDto::slug)
                .filter(slug -> slug.startsWith(SLUG_PREFIX + "tie-"))
                .toList();

        // 마지막에 넣은 것이 id 가 가장 크고, 그것이 맨 앞이어야 한다.
        assertThat(slugs).containsExactly(
                SLUG_PREFIX + "tie-2", SLUG_PREFIX + "tie-1", SLUG_PREFIX + "tie-0");
    }
}
