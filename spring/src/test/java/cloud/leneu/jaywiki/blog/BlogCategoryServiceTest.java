package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.common.NotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogCategoryServiceTest {

    @Autowired BlogCategoryService service;
    @Autowired BlogPostRepository posts;
    @Autowired JdbcTemplate jdbc;

    // 이 테스트가 만드는 하위 카테고리들은 공유 DB(Testcontainers 컨테이너 재사용)에 남아
    // 다른 테스트를 오염시킬 수 있다. BlogSchemaTest 의 관례를 따라 명시적으로 지운다.
    // slug 가 UNIQUE 라 지우지 않으면 재실행 시 중복 slug 로 실패한다.
    // tb_blog_post 는 tb_blog_category 에 on delete restrict 이므로 글을 먼저 지운다.
    @AfterEach
    void 만든_카테고리를_지운다() {
        jdbc.update("delete from public.tb_blog_post where slug in (?, ?, ?)",
                "count-post-1", "count-post-2", "count-post-3");
        jdbc.update("delete from public.tb_blog_category where slug in (?, ?, ?, ?, ?, ?, ?)",
                "editors", "depth-child", "depth-grandchild", "apps",
                "count-active", "count-draft", "count-empty");
    }

    private BlogPost save(String slug, Long categoryId, String status, String publishedAt) {
        BlogPost post = new BlogPost();
        post.setSlug(slug);
        post.setCategoryId(categoryId);
        post.setTitle("제목");
        post.setSummary("요약");
        post.setBody("본문");
        post.setStatus(status);
        post.setPublishedAt(publishedAt == null ? null : OffsetDateTime.parse(publishedAt));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        return posts.save(post);
    }

    @Test
    void 하위_카테고리를_한_단계까지_만들_수_있다() {
        BlogCategory parent = service.bySlug("tools-workflow");

        BlogCategory child = service.create("editors", "에디터", null, parent.getId(), 0);

        assertThat(child.getParentId()).isEqualTo(parent.getId());
    }

    @Test
    void 카테고리는_2단까지만_허용한다() {
        BlogCategory parent = service.bySlug("tech-lab");
        BlogCategory child = service.create("depth-child", "자식", null, parent.getId(), 0);

        // 자식을 부모로 지정하면 3단이 되므로 거부한다.
        assertThatThrownBy(() -> service.create("depth-grandchild", "손자", null, child.getId(), 0))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("2단");
    }

    @Test
    void 트리는_부모만_돌려주고_자식을_안에_담는다() {
        BlogCategory parent = service.bySlug("personal-projects");
        service.create("apps", "앱", null, parent.getId(), 0);

        BlogCategoryDto found = service.tree().stream()
                .filter(c -> c.slug().equals("personal-projects"))
                .findFirst()
                .orElseThrow();

        assertThat(found.children()).extracting(BlogCategoryDto::slug).contains("apps");
        assertThat(service.tree()).extracting(BlogCategoryDto::slug).doesNotContain("apps");
    }

    @Test
    void 없는_slug_는_NotFound_다() {
        assertThatThrownBy(() -> service.bySlug("nope")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void 트리는_카테고리별_발행_글_수를_센다() {
        BlogCategory withPosts = service.create("count-active", "카운트-발행", null, null, 0);
        BlogCategory onlyDrafts = service.create("count-draft", "카운트-초안", null, null, 0);
        BlogCategory empty = service.create("count-empty", "카운트-없음", null, null, 0);

        save("count-post-1", withPosts.getId(), "published", "2026-07-01T00:00:00Z");
        save("count-post-2", withPosts.getId(), "published", "2026-07-02T00:00:00Z");
        save("count-post-3", onlyDrafts.getId(), "draft", null);

        Map<String, Long> counts = service.tree().stream()
                .collect(Collectors.toMap(BlogCategoryDto::slug, BlogCategoryDto::postCount));

        assertThat(counts.get("count-active")).isEqualTo(2L);
        assertThat(counts.get("count-draft")).isEqualTo(0L);
        assertThat(counts.get("count-empty")).isEqualTo(0L);
        assertThat(counts).containsKey("count-empty");
    }
}
