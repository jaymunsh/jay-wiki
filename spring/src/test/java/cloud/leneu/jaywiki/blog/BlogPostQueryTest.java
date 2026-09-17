package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import cloud.leneu.jaywiki.common.NotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogPostQueryTest {

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

    // 공유 DB(Testcontainers 컨테이너 재사용)에 다른 테스트 클래스가 남을 수 있으므로
    // BlogCategoryServiceTest 의 관례를 따라 명시적으로 지운다.
    @AfterEach
    void 만든_글을_지운다() {
        jdbc.update("delete from public.tb_blog_post");
    }

    private BlogPost save(String slug, String title, String status, String publishedAt) {
        BlogPost post = new BlogPost();
        post.setSlug(slug);
        post.setCategoryId(labId);
        post.setTitle(title);
        post.setSummary("요약");
        post.setBody("본문");
        post.setStatus(status);
        post.setPublishedAt(publishedAt == null ? null : OffsetDateTime.parse(publishedAt));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        return posts.save(post);
    }

    @Test
    void 목록은_발행된_글만_최신순으로_돌려준다() {
        save("old", "이전 글", "published", "2026-07-01T00:00:00Z");
        save("new", "최신 글", "published", "2026-08-01T00:00:00Z");
        save("hidden", "초안", "draft", null);

        assertThat(service.published()).extracting(BlogPostSummaryDto::slug)
                .containsExactly("new", "old");
    }

    @Test
    void 카테고리_목록은_그_카테고리_글만_돌려준다() {
        save("in", "여기 글", "published", "2026-08-01T00:00:00Z");

        BlogPost other = save("other", "다른 카테고리", "published", "2026-08-02T00:00:00Z");
        other.setCategoryId(categories.findBySlug("team-projects").orElseThrow().getId());
        posts.save(other);

        assertThat(service.byCategory("tech-lab")).extracting(BlogPostSummaryDto::slug)
                .containsExactly("in");
    }

    @Test
    void 단건_조회는_카테고리_이름을_함께_준다() {
        BlogPost saved = save("one", "글 하나", "published", "2026-08-01T00:00:00Z");

        BlogPostDto dto = service.get(saved.getId());

        assertThat(dto.title()).isEqualTo("글 하나");
        assertThat(dto.categorySlug()).isEqualTo("tech-lab");
        assertThat(dto.categoryName()).isEqualTo("기술 실험");
    }

    @Test
    void 초안은_공개_조회에서_보이지_않는다() {
        BlogPost draft = save("draft-one", "초안", "draft", null);

        assertThatThrownBy(() -> service.get(draft.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void 이웃_글은_발행일_기준_앞뒤다() {
        BlogPost older = save("a", "이전", "published", "2026-07-01T00:00:00Z");
        BlogPost middle = save("b", "가운데", "published", "2026-07-15T00:00:00Z");
        BlogPost newer = save("c", "다음", "published", "2026-08-01T00:00:00Z");

        BlogPostService.Neighbors neighbors = service.neighbors(middle.getId());

        assertThat(neighbors.prev().id()).isEqualTo(older.getId());
        assertThat(neighbors.next().id()).isEqualTo(newer.getId());
    }

    @Test
    void 가장_오래된_글은_이전_글이_없다() {
        BlogPost first = save("a", "이전", "published", "2026-07-01T00:00:00Z");
        save("b", "다음", "published", "2026-08-01T00:00:00Z");

        BlogPostService.Neighbors neighbors = service.neighbors(first.getId());

        assertThat(neighbors.prev()).isNull();
        assertThat(neighbors.next().slug()).isEqualTo("b");
    }

    @Test
    void 가장_최근_글은_다음_글이_없다() {
        save("a", "이전", "published", "2026-07-01T00:00:00Z");
        BlogPost last = save("b", "다음", "published", "2026-08-01T00:00:00Z");

        BlogPostService.Neighbors neighbors = service.neighbors(last.getId());

        assertThat(neighbors.next()).isNull();
        assertThat(neighbors.prev().slug()).isEqualTo("a");
    }
}
