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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 관리 API 는 ADMIN 만 읽는다.
 * SecurityConfig 의 GET /api/** permitAll 이 앞에 있어서, 명시 규칙이 없으면 draft 가 샌다.
 *
 * 인증은 spring-security-test 를 넣지 않고 실제 로그인으로 한다.
 * 저장소의 기존 인증 테스트가 그렇게 하고 있고, 그래야 쿠키와 JWT 경로까지 함께 확인된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogAdminApiTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;

    private Long draftId;
    private Cookie adminCookie;

    /** 저장 테스트가 만드는 글. 자기가 만든 것은 자기가 지운다. */
    private Long extraPostId;

    /** 로컬·테스트의 관리자 기본 계정. TOTP 는 꺼져 있으면 통과한다. */
    private Cookie login() throws Exception {
        return mvc.perform(post("/api/auth/admin-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin1234\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("jw_token");
    }

    @BeforeEach
    void setUp() throws Exception {
        adminCookie = login();

        BlogPost draft = new BlogPost();
        draft.setSlug("admin-draft");
        draft.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        draft.setTitle("아직 공개하지 않은 글");
        draft.setBody("본문");
        draft.setStatus("draft");
        draft.setCreatedAt(OffsetDateTime.now());
        draft.setUpdatedAt(OffsetDateTime.now());
        draftId = posts.save(draft).getId();
    }

    @AfterEach
    void tearDown() {
        posts.deleteById(draftId);
        if (extraPostId != null) {
            posts.deleteById(extraPostId);
            extraPostId = null;
        }
    }

    private long idOf(String json) {
        return Long.parseLong(json.replaceAll(".*?\"id\":(\\d+).*", "$1"));
    }

    @Test
    void 인증_없이는_관리_목록을_읽을_수_없다() throws Exception {
        mvc.perform(get("/api/admin/blog/posts"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void 관리자는_draft_를_본다() throws Exception {
        mvc.perform(get("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='admin-draft')].status").value("draft"));
    }

    @Test
    void 관리자_단건_조회는_조회수를_올리지_않는다() throws Exception {
        long before = posts.findById(draftId).orElseThrow().getViewCount();
        mvc.perform(get("/api/admin/blog/posts/" + draftId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("아직 공개하지 않은 글"));
        long after = posts.findById(draftId).orElseThrow().getViewCount();
        assertThat(after).isEqualTo(before);
    }

    @Test
    void 공개_목록에는_draft_가_없다() throws Exception {
        mvc.perform(get("/api/blog/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='admin-draft')]").isEmpty());
    }

    @Test
    void published_로_저장할_때_발행일이_비면_지금_시각을_넣는다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"auto-published-at","title":"발행일 없이 발행",
                                 "body":"본문","categoryId":%d,"status":"published","tags":["a","b"]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publishedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        extraPostId = idOf(created);
    }

    /**
     * 발행일을 안 보내는 호출부가 있다. 배포의 내부 콘텐츠 싱크가 그렇다
     * (scripts/publish-blog-drafts.mjs 의 publishThroughInternalSync).
     * 그때 기존 발행일을 지금 시각으로 덮으면, 배포로 글을 고칠 때마다 발행일이 그날로 밀린다.
     */
    @Test
    void 발행일을_안_보내면_기존_발행일을_그대로_둔다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"keeps-published-at","title":"발행일 유지",
                                 "body":"본문","categoryId":%d,"status":"published",
                                 "publishedAt":"2026-01-02T03:04:05Z","tags":[]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        extraPostId = idOf(created);
        OffsetDateTime before = posts.findById(extraPostId).orElseThrow().getPublishedAt();

        mvc.perform(put("/api/admin/blog/posts/" + extraPostId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"keeps-published-at","title":"발행일 유지 — 고친 제목",
                                 "body":"고친 본문","categoryId":%d,"status":"published","tags":[]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk());

        assertThat(posts.findById(extraPostId).orElseThrow().getPublishedAt()).isEqualTo(before);
    }

    /**
     * 초안 전부를 한꺼번에 올리는 발행 스크립트가 있다(scripts/publish-blog-drafts.mjs).
     * 안 바뀐 글까지 저장하면 updatedAt 이 다 오늘로 튀고, 화면에 없던 '수정됨' 이 붙는다.
     * 배포의 내부 싱크는 이미 걸러 왔다 — 그 판단을 서버 한 곳으로 모은다.
     */
    @Test
    void 내용이_같으면_저장하지_않아_수정일이_안_바뀐다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String payload = """
                {"slug":"unchanged-keeps-updated-at","title":"안 바뀐 글",
                 "body":"본문 그대로","categoryId":%d,"status":"published","tags":["b","a"]}
                """.formatted(categoryId);
        String created = mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        extraPostId = idOf(created);
        OffsetDateTime before = posts.findById(extraPostId).orElseThrow().getUpdatedAt();

        // 같은 내용을 다시 올린다. 태그 순서만 뒤집고 줄바꿈을 섞어도 같은 글이다.
        mvc.perform(put("/api/admin/blog/posts/" + extraPostId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"unchanged-keeps-updated-at","title":"안 바뀐 글",
                                 "body":"본문 그대로\\n","categoryId":%d,"status":"published","tags":["a","b"]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk());

        assertThat(posts.findById(extraPostId).orElseThrow().getUpdatedAt()).isEqualTo(before);
    }

    @Test
    void 내용이_바뀌면_수정일이_갱신된다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"changed-bumps-updated-at","title":"고칠 글",
                                 "body":"처음 본문","categoryId":%d,"status":"published","tags":[]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        extraPostId = idOf(created);
        OffsetDateTime before = posts.findById(extraPostId).orElseThrow().getUpdatedAt();

        mvc.perform(put("/api/admin/blog/posts/" + extraPostId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"changed-bumps-updated-at","title":"고칠 글",
                                 "body":"고친 본문","categoryId":%d,"status":"published","tags":[]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk());

        assertThat(posts.findById(extraPostId).orElseThrow().getUpdatedAt()).isAfter(before);
    }

    /** 발행일만 고치는 저장이 '안 바뀐 것' 으로 걸러지면 안 된다. same() 은 발행일을 안 본다. */
    @Test
    void 발행일만_바꿔도_저장된다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"date-only-change","title":"날짜만 고칠 글","body":"본문",
                                 "categoryId":%d,"status":"published",
                                 "publishedAt":"2026-01-02T03:04:05Z","tags":[]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        extraPostId = idOf(created);

        mvc.perform(put("/api/admin/blog/posts/" + extraPostId).cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"date-only-change","title":"날짜만 고칠 글","body":"본문",
                                 "categoryId":%d,"status":"published",
                                 "publishedAt":"2025-12-25T00:00:00Z","tags":[]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk());

        assertThat(posts.findById(extraPostId).orElseThrow().getPublishedAt())
                .isEqualTo(OffsetDateTime.parse("2025-12-25T00:00:00Z"));
    }

    @Test
    void 태그는_저장하면서_정규화된다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"with-tags","title":"태그 글","body":"본문",
                                 "categoryId":%d,"status":"draft","tags":["kotlin","spring"]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        extraPostId = idOf(created);
    }

    @Test
    void 없는_카테고리로_저장하면_404() throws Exception {
        mvc.perform(post("/api/admin/blog/posts").cookie(adminCookie).header("Origin", "http://localhost").header("Host", "localhost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"bad-category","title":"제목","body":"본문",
                                 "categoryId":999999,"status":"draft"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void 인증_없이는_글을_저장할_수_없다() throws Exception {
        mvc.perform(post("/api/admin/blog/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"nope\",\"title\":\"제목\",\"body\":\"본문\",\"categoryId\":1}"))
                .andExpect(status().is4xxClientError());
    }
}
