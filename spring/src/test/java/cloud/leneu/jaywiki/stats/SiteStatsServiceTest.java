package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.BlogCategoryRepository;
import cloud.leneu.jaywiki.blog.BlogPost;
import cloud.leneu.jaywiki.blog.BlogPostRepository;
import cloud.leneu.jaywiki.blog.BlogStatsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SiteStatsServiceTest {

    @Autowired BlogStatsService blogStats;
    @Autowired SiteStatsService stats;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;
    @Autowired StringRedisTemplate redis;

    private Long postId;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from public.tb_site_daily_stat");
        jdbc.update("delete from public.tb_site_referrer_daily");
        jdbc.update("delete from public.tb_site_device_daily");
        jdbc.update("delete from public.tb_blog_post where slug like 'stats-%'");
        Set<String> keys = redis.keys("*:visitors:*");
        if (keys != null && !keys.isEmpty()) redis.delete(keys);

        BlogPost post = new BlogPost();
        post.setSlug("stats-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("통계용 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @AfterEach
    void tearDown() {
        jdbc.update("delete from public.tb_site_daily_stat");
        jdbc.update("delete from public.tb_site_referrer_daily");
        jdbc.update("delete from public.tb_site_device_daily");
        jdbc.update("delete from public.tb_blog_post where slug like 'stats-%'");
        Set<String> keys = redis.keys("*:visitors:*");
        if (keys != null && !keys.isEmpty()) redis.delete(keys);
    }

    @Test
    void 조회하면_글과_오늘_조회수가_함께_증가한다() {
        blogStats.recordView(postId, "121.135.1.1", null, null);
        blogStats.recordView(postId, "121.135.1.1", null, null);

        assertThat(posts.findById(postId).orElseThrow().getViewCount()).isEqualTo(2L);
        assertThat(stats.summary(SiteStatsService.BLOG).todayViews()).isEqualTo(2L);
    }

    @Test
    void 같은_방문자는_하루에_한_번만_센다() {
        blogStats.recordView(postId, "121.135.1.1", null, null);
        blogStats.recordView(postId, "121.135.1.1", null, null);
        blogStats.recordView(postId, "121.135.1.1", null, null);

        assertThat(stats.summary(SiteStatsService.BLOG).todayViews()).isEqualTo(3L);
        assertThat(stats.summary(SiteStatsService.BLOG).todayVisitors()).isEqualTo(1L);
    }

    @Test
    void 다른_방문자는_따로_센다() {
        blogStats.recordView(postId, "121.135.1.1", null, null);
        blogStats.recordView(postId, "203.0.113.9", null, null);

        assertThat(stats.summary(SiteStatsService.BLOG).todayVisitors()).isEqualTo(2L);
    }

    @Test
    void 유입_채널이_버킷별로_쌓인다() {
        blogStats.recordView(postId, "121.135.1.1", "https://www.google.com/search?q=x", null);
        blogStats.recordView(postId, "203.0.113.9", "https://x.com/a/status/1", null);
        blogStats.recordView(postId, "198.51.100.4", "https://blog.leneu.cloud/1/prev", null);
        blogStats.recordView(postId, "198.51.100.7", null, null);

        SiteStatsService.Summary summary = stats.summary(SiteStatsService.BLOG);
        assertThat(summary.refSearch()).isEqualTo(1L);
        assertThat(summary.refSns()).isEqualTo(1L);
        assertThat(summary.refInternal()).isEqualTo(1L);
        assertThat(summary.refOther()).isEqualTo(1L);
    }

    /** 사이트 안에서의 이동이 밖에서 온 유입으로 섞이지 않는다 -- 이번에 고친 결함이다. */
    @Test
    void 내부_이동은_외부_유입과_따로_쌓인다() {
        blogStats.recordView(postId, "121.135.1.1", "https://blog.leneu.cloud/1/prev", null);
        blogStats.recordView(postId, "203.0.113.9", "https://example.com/link", null);

        assertThat(stats.referrers(SiteStatsService.BLOG, 1))
                .containsExactlyInAnyOrder(
                        new SiteStatsService.SourceCount("internal", 1L),
                        new SiteStatsService.SourceCount("other", 1L));
    }

    @Test
    void 위키와_블로그는_같은_표에_쌓여도_섞이지_않는다() {
        blogStats.recordView(postId, "121.135.1.1", "https://www.google.com/search?q=x", null);
        stats.recordView(SiteStatsService.WIKI, "203.0.113.9", "https://x.com/a/status/1", null);

        assertThat(stats.summary(SiteStatsService.BLOG).refSearch()).isEqualTo(1L);
        assertThat(stats.summary(SiteStatsService.BLOG).refSns()).isZero();
        assertThat(stats.summary(SiteStatsService.WIKI).refSns()).isEqualTo(1L);
        assertThat(stats.summary(SiteStatsService.WIKI).refSearch()).isZero();
        assertThat(stats.referrers(SiteStatsService.WIKI, 1))
                .containsExactly(new SiteStatsService.SourceCount("sns:x", 1L));
    }

    @Test
    void 방문자_식별자는_원본_IP_로_저장되지_않는다() {
        blogStats.recordView(postId, "121.135.1.1", null, null);

        Set<String> keys = redis.keys("*:visitors:*");
        assertThat(keys).isNotEmpty();
        for (String key : keys) {
            Set<String> members = redis.opsForSet().members(key);
            assertThat(members).isNotNull();
            assertThat(members).noneMatch(m -> m.contains("121.135.1.1"));
        }
    }

    @Test
    void 방문자_집합에는_만료가_걸려_있다() {
        blogStats.recordView(postId, "121.135.1.1", null, null);

        Set<String> keys = redis.keys("*:visitors:*");
        assertThat(keys).isNotEmpty();
        for (String key : keys) {
            Long ttl = redis.getExpire(key);
            assertThat(ttl).isNotNull();
            assertThat(ttl).isGreaterThan(0L);
        }
    }

    @Test
    void 같은_날_반복_조회는_만료_시각을_늘리지_않는다() {
        blogStats.recordView(postId, "121.135.1.1", null, null);
        Set<String> keys = redis.keys("*:visitors:*");
        assertThat(keys).isNotEmpty();
        String key = keys.iterator().next();
        Long firstTtl = redis.getExpire(key);
        assertThat(firstTtl).isNotNull();

        try {
            Thread.sleep(1200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        blogStats.recordView(postId, "203.0.113.9", null, null);
        Long secondTtl = redis.getExpire(key);
        assertThat(secondTtl).isNotNull();
        assertThat(secondTtl).isLessThanOrEqualTo(firstTtl);
    }
}
