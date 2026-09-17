package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogSearchHitDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogSearchQueryTest {

    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogPostService service;
    @Autowired JdbcTemplate jdbc;

    private Long labId;

    @BeforeEach
    void setUp() {
        posts.deleteAll();
        labId = categories.findBySlug("tech-lab").orElseThrow().getId();
    }

    @AfterEach
    void 만든_글을_지운다() {
        jdbc.update("delete from public.tb_blog_post");
    }

    private void save(String slug, String title, String summary, String body, String status, String publishedAt) {
        BlogPost post = new BlogPost();
        post.setSlug(slug);
        post.setCategoryId(labId);
        post.setTitle(title);
        post.setSummary(summary);
        post.setBody(body);
        post.setStatus(status);
        post.setPublishedAt(OffsetDateTime.parse(publishedAt));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        posts.save(post);
    }

    @Test
    void 본문에만_있는_말도_찾고_스니펫을_붙인다() {
        save("a", "제목", "요약", "연결 관리는 HikariCP 가 맡는다", "published", "2026-07-01T00:00:00Z");

        List<BlogSearchHitDto> hits = service.search("HikariCP");

        assertThat(hits).hasSize(1);
        assertThat(hits.getFirst().snippet()).contains("HikariCP");
    }

    @Test
    void 제목이_걸린_글이_위로_온다() {
        save("body-hit", "다른 제목", "요약", "본문에 캐시 이야기", "published", "2026-08-01T00:00:00Z");
        save("title-hit", "캐시 이야기", "요약", "본문", "published", "2026-07-01T00:00:00Z");

        List<BlogSearchHitDto> hits = service.search("캐시");

        // 발행일은 body-hit 이 더 최신인데도 제목이 걸린 글이 앞에 온다.
        assertThat(hits).extracting(BlogSearchHitDto::slug).containsExactly("title-hit", "body-hit");
    }

    @Test
    void 제목만_걸리면_스니펫은_null_이다() {
        save("a", "캐시 이야기", "요약", "본문에는 없다", "published", "2026-07-01T00:00:00Z");

        assertThat(service.search("캐시").getFirst().snippet()).isNull();
    }

    @Test
    void 대소문자를_가리지_않는다() {
        save("a", "제목", "요약", "본문에 hikaricp", "published", "2026-07-01T00:00:00Z");

        assertThat(service.search("HIKARICP")).hasSize(1);
    }

    @Test
    void 한국어_활용형_안에서도_걸린다() {
        save("a", "제목", "요약", "캐시를 지웠는데 왜 안 바뀌지", "published", "2026-07-01T00:00:00Z");

        assertThat(service.search("캐시")).hasSize(1);
    }

    @Test
    void 발행되지_않은_글은_빼고_찾는다() {
        save("draft", "캐시 초안", "요약", "본문", "draft", "2026-07-01T00:00:00Z");

        assertThat(service.search("캐시")).isEmpty();
    }

    @Test
    void 두_글자_미만은_찾지_않는다() {
        save("a", "캐시 이야기", "요약", "본문", "published", "2026-07-01T00:00:00Z");

        assertThat(service.search("캐")).isEmpty();
        assertThat(service.search(" ")).isEmpty();
        assertThat(service.search(null)).isEmpty();
    }

    @Test
    void LIKE_특수문자는_글자_그대로_찾는다() {
        save("plain", "제목", "요약", "여기에는 퍼센트 기호가 없다", "published", "2026-07-01T00:00:00Z");
        save("literal", "제목", "요약", "적중률 100% 라고 적었다", "published", "2026-07-02T00:00:00Z");

        // escape 하지 않으면 %% 가 모든 글에 걸린다.
        assertThat(service.search("100%")).extracting(BlogSearchHitDto::slug).containsExactly("literal");
    }
}
