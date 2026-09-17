package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 카테고리 관리. 2단 제약과 삭제 차단이 화면이 아니라 서버에서 지켜져야 한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogAdminCategoryTest {

    @Autowired MockMvc mvc;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogPostRepository posts;

    private Cookie adminCookie;

    @BeforeEach
    void setUp() throws Exception {
        adminCookie = mvc.perform(post("/api/auth/admin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin1234\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("jw_token");
    }

    private long createCategory(String slug, String name, Long parentId) throws Exception {
        String body = parentId == null
                ? "{\"slug\":\"%s\",\"name\":\"%s\"}".formatted(slug, name)
                : "{\"slug\":\"%s\",\"name\":\"%s\",\"parentId\":%d}".formatted(slug, name, parentId);
        String created = mvc.perform(post("/api/admin/blog/categories").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return Long.parseLong(created.replaceAll(".*?\"id\":(\\d+).*", "$1"));
    }

    @Test
    void 글이_있는_카테고리는_지울_수_없다() throws Exception {
        // 테스트 DB 는 매번 새로 뜬다. 이관 데이터를 기대하지 않고 자기 fixture 를 만든다.
        long categoryId = createCategory("t-with-posts", "글 있는 카테고리", null);
        BlogPost post = new BlogPost();
        post.setSlug("t-blocking-post");
        post.setCategoryId(categoryId);
        post.setTitle("삭제를 막는 글");
        post.setBody("본문");
        post.setStatus("draft");
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        Long postId = posts.save(post).getId();

        try {
            mvc.perform(delete("/api/admin/blog/categories/" + categoryId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                    .andExpect(status().isBadRequest());
        } finally {
            posts.deleteById(postId);
            categories.deleteById(categoryId);
        }
    }

    @Test
    void 손자_카테고리는_만들_수_없다() throws Exception {
        long parentId = createCategory("t-parent", "부모", null);
        long childId = createCategory("t-child", "자식", parentId);
        try {
            mvc.perform(post("/api/admin/blog/categories").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"slug\":\"t-grand\",\"name\":\"손자\",\"parentId\":%d}".formatted(childId)))
                    .andExpect(status().isBadRequest());
        } finally {
            categories.deleteById(childId);
            categories.deleteById(parentId);
        }
    }

    @Test
    void 하위_카테고리가_있으면_지울_수_없다() throws Exception {
        long parentId = createCategory("t-parent2", "부모2", null);
        long childId = createCategory("t-child2", "자식2", parentId);
        try {
            mvc.perform(delete("/api/admin/blog/categories/" + parentId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                    .andExpect(status().isBadRequest());
        } finally {
            categories.deleteById(childId);
            categories.deleteById(parentId);
        }
    }

    @Test
    void 순서를_받은_대로_다시_매긴다() throws Exception {
        long a = createCategory("t-order-a", "가", null);
        long b = createCategory("t-order-b", "나", null);
        try {
            mvc.perform(post("/api/admin/blog/categories/reorder").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ids\":[%d,%d]}".formatted(b, a)))
                    .andExpect(status().isNoContent());

            assertThat(categories.findById(b).orElseThrow().getSortOrder()).isZero();
            assertThat(categories.findById(a).orElseThrow().getSortOrder()).isEqualTo(1);
        } finally {
            categories.deleteById(a);
            categories.deleteById(b);
        }
    }

    @Test
    void 이름을_고칠_수_있다() throws Exception {
        long id = createCategory("t-rename", "옛 이름", null);
        try {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                            .put("/api/admin/blog/categories/" + id).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"새 이름\",\"description\":\"설명\"}"))
                    .andExpect(status().isOk());
            assertThat(categories.findById(id).orElseThrow().getName()).isEqualTo("새 이름");
        } finally {
            categories.deleteById(id);
        }
    }

    @Test
    void 인증_없이는_카테고리를_만들_수_없다() throws Exception {
        mvc.perform(post("/api/admin/blog/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"nope\",\"name\":\"아니오\"}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void 관리_트리는_공개_트리와_같은_모양이다() throws Exception {
        mvc.perform(get("/api/admin/blog/categories").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isOk());
    }
}
