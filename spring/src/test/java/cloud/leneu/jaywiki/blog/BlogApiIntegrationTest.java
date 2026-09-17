package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.stats.SiteStatsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 조회는 누구나, 댓글 작성도 로그인 없이 되어야 한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogApiIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogStatsService stats;
    @Autowired SiteStatsService siteStats;
    @Autowired JdbcTemplate jdbc;
    @Autowired StringRedisTemplate redis;

    private Long postId;

    /** 인기 글 테스트가 만드는 두 번째 글. @AfterEach 가 자기가 만든 것만 지우는 관례를 지킨다. */
    private Long popularPostId;

    @BeforeEach
    void setUp() {
        posts.deleteAll();
        BlogPost post = new BlogPost();
        post.setSlug("api-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("API 로 읽을 글");
        post.setSummary("요약");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @AfterEach
    void tearDown() {
        // 이 클래스는 지금은 유일한 @AutoConfigureMockMvc 라 자기만의 Spring 컨텍스트를 갖지만,
        // 다른 클래스가 @AutoConfigureMockMvc 를 추가하는 순간 컨텍스트를 공유하게 된다.
        // @BeforeEach 의 posts.deleteAll() 이 그때 다른 클래스의 fixture 까지 지우지 않도록
        // 이 클래스가 만든 것은 이 클래스가 지운다.
        // tb_blog_comment.post_id 는 on delete cascade 라 글만 지우면 댓글도 함께 지워진다.
        posts.deleteById(postId);
        if (popularPostId != null) {
            posts.deleteById(popularPostId);
            popularPostId = null;
        }
        jdbc.update("delete from public.tb_site_daily_stat");
        jdbc.update("delete from public.tb_site_referrer_daily");
        jdbc.update("delete from public.tb_site_device_daily");
        Set<String> keys = redis.keys("blog:visitors:*");
        if (keys != null && !keys.isEmpty()) redis.delete(keys);
    }

    @Test
    void 카테고리와_목록은_인증_없이_읽힌다() throws Exception {
        mvc.perform(get("/api/blog/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("personal-projects"));

        mvc.perform(get("/api/blog/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("api-post"));
    }

    @Test
    void 단건_조회는_카테고리_이름을_준다() throws Exception {
        mvc.perform(get("/api/blog/posts/" + postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryName").value("기술 실험"));
    }

    @Test
    void 없는_글은_404_다() throws Exception {
        mvc.perform(get("/api/blog/posts/999999")).andExpect(status().isNotFound());
    }

    @Test
    void 없는_글_조회는_통계에_잡히지_않는다() throws Exception {
        long before = siteStats.summary(SiteStatsService.BLOG).totalViews();

        mvc.perform(get("/api/blog/posts/999999")).andExpect(status().isNotFound());

        assertThat(siteStats.summary(SiteStatsService.BLOG).totalViews()).isEqualTo(before);
    }

    @Test
    void 상세_API_조회만으로는_집계하지_않는다() throws Exception {
        long before = siteStats.summary(SiteStatsService.BLOG).totalViews();

        mvc.perform(get("/api/blog/posts/" + postId).header("cf-connecting-ip", "198.51.100.77"))
                .andExpect(status().isOk());

        assertThat(siteStats.summary(SiteStatsService.BLOG).totalViews()).isEqualTo(before);
    }

    @Test
    void 댓글은_로그인_없이_작성되고_앞자리만_노출된다() throws Exception {
        mvc.perform(post("/api/blog/posts/" + postId + "/comments")
                        .header("cf-connecting-ip", "121.135.99.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"지나가던개발자","password":"pw1234","body":"잘 봤습니다"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ipPrefix").value("121.135"));

        mvc.perform(get("/api/blog/posts/" + postId + "/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].authorName").value("지나가던개발자"));
    }

    @Test
    void 암호가_틀리면_댓글이_지워지지_않는다() throws Exception {
        String created = mvc.perform(post("/api/blog/posts/" + postId + "/comments")
                        .header("cf-connecting-ip", "121.135.99.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"작성자","password":"pw1234","body":"지울 댓글"}
                                """))
                .andReturn().getResponse().getContentAsString();
        long commentId = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mvc.perform(post("/api/blog/comments/" + commentId + "/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"wrong\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/blog/comments/" + commentId + "/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"pw1234\"}"))
                .andExpect(status().isNoContent());
    }

    /**
     * GlobalExceptionHandler 는 BadRequestException 만 400 으로 바꾼다.
     * 이 테스트가 없으면 나중에 누군가 "IllegalArgumentException -> 400" 전역 매핑을
     * 다시 넣고 싶어질 수 있으므로, 그 유혹을 막기 위한 핀 테스트다.
     */
    @Test
    void BadRequestException은_problem_json으로_400을_준다() throws Exception {
        String created = mvc.perform(post("/api/blog/posts/" + postId + "/comments")
                        .header("cf-connecting-ip", "121.135.99.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"작성자","password":"pw1234","body":"핀 테스트용 댓글"}
                                """))
                .andReturn().getResponse().getContentAsString();
        long commentId = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mvc.perform(post("/api/blog/comments/" + commentId + "/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"wrong\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")));
    }

    /**
     * 도메인랩(blog 와 무관한 bounded context)의 순수 IllegalArgumentException 은
     * 여전히 500 으로 떨어져야 한다 — Task 7 의 GlobalExceptionHandler 변경이
     * 그 동작에 영향을 주지 않았음을 확인한다.
     */
    @Test
    void 도메인랩의_IllegalArgumentException은_그대로_500이다() throws Exception {
        mvc.perform(post("/api/domain-scenarios/no-such-scenario/runs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"anything\"}"))
                .andExpect(status().isInternalServerError());
    }

    @Test
    void 인기_글은_조회수_내림차순이다() throws Exception {
        BlogPost hot = new BlogPost();
        hot.setSlug("hot-post");
        hot.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        hot.setTitle("많이 읽힌 글");
        hot.setBody("본문");
        hot.setStatus("published");
        hot.setPublishedAt(OffsetDateTime.parse("2026-07-01T00:00:00Z")); // 최신순으로는 뒤에 온다
        hot.setViewCount(99);
        hot.setCreatedAt(OffsetDateTime.now());
        hot.setUpdatedAt(OffsetDateTime.now());
        popularPostId = posts.save(hot).getId();

        mvc.perform(get("/api/blog/posts/popular"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("hot-post"));
    }

    @Test
    void 인기_글_limit_은_범위를_벗어나면_400() throws Exception {
        mvc.perform(get("/api/blog/posts/popular").param("limit", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 통계는_인증_없이_읽힌다() throws Exception {
        mvc.perform(get("/api/blog/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalViews").isNumber())
                .andExpect(jsonPath("$.totalVisitors").isNumber());
    }
}
