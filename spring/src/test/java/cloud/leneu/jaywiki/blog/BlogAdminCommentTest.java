package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 관리자는 암호 없이 지우고 되살린다. 지운 댓글은 공개 목록에서 사라진다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogAdminCommentTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogCommentRepository comments;

    private Long postId;
    private Long commentId;
    private Cookie adminCookie;

    @BeforeEach
    void setUp() throws Exception {
        adminCookie = mvc.perform(post("/api/auth/admin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin1234\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("jw_token");

        BlogPost post = new BlogPost();
        post.setSlug("comment-admin-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("댓글 관리 대상 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.now());
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();

        BlogComment comment = new BlogComment();
        comment.setPostId(postId);
        comment.setAuthorName("지나가던개발자");
        comment.setPasswordHash("{noop}x");
        comment.setBody("관리 대상 댓글");
        comment.setIpPrefix("121.135");
        comment.setIpHash("hash");
        comment.setCreatedAt(OffsetDateTime.now());
        commentId = comments.save(comment).getId();
    }

    @AfterEach
    void tearDown() {
        // tb_blog_comment.post_id 는 on delete cascade 라 글만 지우면 댓글도 함께 사라진다.
        posts.deleteById(postId);
    }

    @Test
    void 관리자는_암호_없이_지우고_되살린다() throws Exception {
        mvc.perform(delete("/api/admin/blog/comments/" + commentId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/blog/posts/" + postId + "/comments"))
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(get("/api/admin/blog/comments").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost").param("deleted", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + commentId + ")]").isNotEmpty());

        mvc.perform(post("/api/admin/blog/comments/" + commentId + "/restore").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/blog/posts/" + postId + "/comments"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void 목록은_글_제목을_함께_준다() throws Exception {
        mvc.perform(get("/api/admin/blog/comments").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + commentId + ")].postTitle")
                        .value("댓글 관리 대상 글"));
    }

    @Test
    void 원본_IP_는_어디에도_없다() throws Exception {
        mvc.perform(get("/api/admin/blog/comments").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + commentId + ")].ipPrefix").value("121.135"));
    }

    @Test
    void 인증_없이는_관리_댓글_목록을_못_읽는다() throws Exception {
        mvc.perform(get("/api/admin/blog/comments"))
                .andExpect(status().is4xxClientError());
    }
}
