package cloud.leneu.jaywiki;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 게시판 통합 테스트 — 실제 PostgreSQL + Redis (Testcontainers).
 *
 * - @SpringBootTest 설정을 SearchIntegrationTest 와 동일하게 맞춰 컨텍스트/컨테이너를 재사용
 *   (Flyway 10만 시드가 스위트당 한 번만 돌도록).
 * - 게시판 작성/댓글/본인삭제는 공개(익명)라 별도 인증 없이 호출된다.
 * - V4 시드 10만 건은 전부 과거 created_at + 낮은 id → 방금 만든 글(높은 id)이 목록 맨 앞에 온다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.opensearch.enabled=false"})
@Import(TestcontainersConfiguration.class)
class BoardIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST =
            new ParameterizedTypeReference<>() {};

    private long createPost(String title, String content, String pw) {
        ResponseEntity<Map<String, Object>> r = rest.exchange(
                "/api/board/posts", org.springframework.http.HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(Map.of(
                        "title", title, "content", content, "authorName", "테스터",
                        "password", pw == null ? "" : pw)),
                MAP);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        return ((Number) r.getBody().get("id")).longValue();
    }

    @Test
    void 작성하면_목록_맨앞에_오고_10만건이_보인다() {
        long id = createPost("첫 글 제목", "본문입니다", null);

        ResponseEntity<Map<String, Object>> r =
                rest.exchange("/api/board/posts?page=0&size=20",
                        org.springframework.http.HttpMethod.GET, null, MAP);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);

        Map<String, Object> body = r.getBody();
        assertThat(((Number) body.get("totalElements")).longValue()).isGreaterThanOrEqualTo(100_000);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) body.get("content");
        assertThat(content).hasSize(20);
        assertThat(((Number) content.get(0).get("id")).longValue()).isEqualTo(id);
        assertThat(content.get(0).get("title")).isEqualTo("첫 글 제목");
    }

    @Test
    void 상세를_열_때마다_조회수가_증가한다() {
        long id = createPost("조회수 글", "본문", null);

        ResponseEntity<Map<String, Object>> first =
                rest.exchange("/api/board/posts/" + id, org.springframework.http.HttpMethod.GET, null, MAP);
        ResponseEntity<Map<String, Object>> second =
                rest.exchange("/api/board/posts/" + id, org.springframework.http.HttpMethod.GET, null, MAP);

        long v1 = ((Number) first.getBody().get("views")).longValue();
        long v2 = ((Number) second.getBody().get("views")).longValue();
        assertThat(v2).isGreaterThan(v1);
    }

    @Test
    void 댓글을_달면_목록과_카운트에_반영된다() {
        long id = createPost("댓글 글", "본문", null);

        ResponseEntity<Map<String, Object>> c = rest.exchange(
                "/api/board/posts/" + id + "/comments", org.springframework.http.HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(Map.of("content", "첫 댓글", "authorName", "댓글러")),
                MAP);
        assertThat(c.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<List<Map<String, Object>>> list = rest.exchange(
                "/api/board/posts/" + id + "/comments", org.springframework.http.HttpMethod.GET, null, LIST);
        assertThat(list.getBody()).hasSize(1);
        assertThat(list.getBody().get(0).get("content")).isEqualTo("첫 댓글");

        ResponseEntity<Map<String, Object>> detail =
                rest.exchange("/api/board/posts/" + id, org.springframework.http.HttpMethod.GET, null, MAP);
        assertThat(((Number) detail.getBody().get("commentCount")).intValue()).isEqualTo(1);
    }

    @Test
    void 검색비교는_세_방식을_반환하고_OpenSearch_비활성화도_응답에_담는다() {
        // 공백 없는 유니크 토큰 → 'simple' 토큰화에서도 LIKE/FTS 둘 다 매칭
        String token = "유니크토큰크세사크";
        createPost(token + " 제목", "본문에 " + token + " 포함", null);

        ResponseEntity<Map<String, Object>> r = rest.exchange(
                "/api/board/search?q=" + token, org.springframework.http.HttpMethod.GET, null, MAP);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> methods = (List<Map<String, Object>>) r.getBody().get("methods");
        assertThat(methods).hasSize(3);
        for (Map<String, Object> m : methods.subList(0, 2)) {
            assertThat(((Number) m.get("count")).intValue()).isGreaterThanOrEqualTo(1);
            assertThat(((Number) m.get("elapsedMs")).doubleValue()).isGreaterThanOrEqualTo(0.0);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> hits = (List<Map<String, Object>>) m.get("hits");
            assertThat(hits.get(0).get("snippet")).asString().contains("[[" + token + "]]");
        }
        assertThat(methods.get(2).get("method")).isEqualTo("OpenSearch+nori");
        assertThat(methods.get(2).get("note")).asString().contains("비활성화");
    }

    @Test
    void 검색어_자동완성은_제목_prefix를_반환한다() {
        String prefix = "자동완성유니크";
        createPost(prefix + " 후보 제목", "본문", null);

        ResponseEntity<List<String>> r = rest.exchange(
                "/api/board/suggest?q=" + prefix, org.springframework.http.HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r.getBody()).contains(prefix + " 후보 제목");
    }

    @Test
    void 비밀번호가_맞아야_본인삭제된다() {
        long id = createPost("비번 글", "본문", "secret");

        // 틀린 비번 → 409
        ResponseEntity<String> wrong = rest.exchange(
                "/api/board/posts/" + id + "/delete", org.springframework.http.HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(Map.of("password", "nope")), String.class);
        assertThat(wrong.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // 맞는 비번 → 204
        ResponseEntity<String> ok = rest.exchange(
                "/api/board/posts/" + id + "/delete", org.springframework.http.HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(Map.of("password", "secret")), String.class);
        assertThat(ok.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // 삭제 확인 → 404
        ResponseEntity<String> gone =
                rest.exchange("/api/board/posts/" + id, org.springframework.http.HttpMethod.GET, null, String.class);
        assertThat(gone.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void 로그인_사용자가_글을_쓰면_user_작성자로_저장된다() {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, loginCookie());
        headers.add("X-Jaywiki-Request", "server");

        ResponseEntity<Map<String, Object>> created = rest.exchange(
                "/api/board/posts", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "title", "로그인 사용자 글",
                        "content", "본문",
                        "authorName", "무시될닉네임",
                        "password", "ignored"), headers),
                MAP);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(created.getBody().get("authorType")).isEqualTo("user");
        assertThat(created.getBody().get("authorName")).isEqualTo("관리자");
        assertThat(created.getBody().get("hasPassword")).isEqualTo(false);
    }

    private String loginCookie() {
        ResponseEntity<Map<String, Object>> login = rest.exchange(
                "/api/auth/admin-login", HttpMethod.POST,
                new HttpEntity<>(Map.of("username", "admin", "password", "admin1234")),
                MAP);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        String setCookie = login.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).isNotBlank();
        return setCookie.split(";", 2)[0];
    }
}
