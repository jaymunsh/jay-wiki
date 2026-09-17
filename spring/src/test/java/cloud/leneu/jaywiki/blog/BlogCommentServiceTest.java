package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogCommentCreateRequest;
import cloud.leneu.jaywiki.blog.dto.BlogCommentDto;
import cloud.leneu.jaywiki.common.BadRequestException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogCommentServiceTest {

    @Autowired BlogCommentService comments;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;

    private Long postId;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from public.tb_blog_comment");
        posts.deleteAll();
        BlogPost post = new BlogPost();
        post.setSlug("commented");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("댓글 달릴 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @AfterEach
    void 만든_댓글과_글을_지운다() {
        jdbc.update("delete from public.tb_blog_comment");
        posts.deleteAll();
    }

    private BlogCommentCreateRequest req(String name, String password, String body) {
        return new BlogCommentCreateRequest(name, password, body);
    }

    @Test
    void 표시용_앞자리만_남고_원본_IP_는_저장되지_않는다() {
        comments.create(postId, req("지나가던개발자", "pw1234", "잘 봤습니다"), "121.135.99.7", null);

        List<BlogCommentDto> found = comments.list(postId);
        assertThat(found).hasSize(1);
        assertThat(found.get(0).ipPrefix()).isEqualTo("121.135");

        List<String> stored = jdbc.queryForList(
                "select ip_prefix || '|' || ip_hash from public.tb_blog_comment", String.class);
        assertThat(stored.get(0)).doesNotContain("121.135.99.7");
    }

    @Test
    void 같은_IP_는_같은_hash_다른_IP_는_다른_hash_다() {
        comments.create(postId, req("a", "pw1234", "첫째"), "121.135.99.7", null);
        comments.create(postId, req("b", "pw1234", "둘째"), "121.135.99.7", null);
        comments.create(postId, req("c", "pw1234", "셋째"), "203.0.113.7", null);

        List<String> hashes = jdbc.queryForList(
                "select ip_hash from public.tb_blog_comment order by id", String.class);
        assertThat(hashes.get(0)).isEqualTo(hashes.get(1));
        assertThat(hashes.get(2)).isNotEqualTo(hashes.get(0));
    }

    @Test
    void 암호가_맞아야_지워지고_목록에서_사라진다() {
        BlogCommentDto created = comments.create(postId, req("작성자", "pw1234", "지울 댓글"), "121.135.99.7", null);

        assertThatThrownBy(() -> comments.delete(created.id(), "wrong"))
                .isInstanceOf(BadRequestException.class);
        assertThat(comments.list(postId)).hasSize(1);

        comments.delete(created.id(), "pw1234");
        assertThat(comments.list(postId)).isEmpty();
    }

    @Test
    void 목록은_오래된_순이다() {
        comments.create(postId, req("첫째", "pw1234", "1"), "121.135.99.7", null);
        comments.create(postId, req("둘째", "pw1234", "2"), "121.135.99.7", null);

        assertThat(comments.list(postId)).extracting(BlogCommentDto::authorName)
                .containsExactly("첫째", "둘째");
    }

    @Test
    void 발행되지_않은_글에는_댓글을_달_수_없다() {
        BlogPost draft = new BlogPost();
        draft.setSlug("draft-post");
        draft.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        draft.setTitle("초안");
        draft.setBody("본문");
        draft.setStatus("draft");
        draft.setCreatedAt(OffsetDateTime.now());
        draft.setUpdatedAt(OffsetDateTime.now());
        Long draftId = posts.save(draft).getId();

        assertThatThrownBy(() -> comments.create(draftId, req("x", "pw1234", "안 됨"), "121.135.99.7", null))
                .isInstanceOf(cloud.leneu.jaywiki.common.NotFoundException.class);
    }
}
