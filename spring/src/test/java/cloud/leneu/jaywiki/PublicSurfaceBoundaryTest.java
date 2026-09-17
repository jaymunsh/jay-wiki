package cloud.leneu.jaywiki;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 인증 없이 닿는 면을 고정한다.
 *
 * SecurityConfig 는 규칙 순서가 곧 정책이라, 규칙 하나를 위아래로 옮기면 조용히 열린다.
 * 실제로 GET /api/** 공개 규칙이 /api/admin/** 보다 앞서 있어 관리자 조회가 인증 없이
 * 읽혔다. 값이 아니라 순서가 틀렸던 것이라 사람이 다시 밟기 쉽다. 그래서 테스트로 박는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.board.rate-limit.enabled=true",
                "app.board.rate-limit.capacity=3",
                "app.board.rate-limit.window=1m"
        })
@Import(TestcontainersConfiguration.class)
class PublicSurfaceBoundaryTest {

    @Autowired
    TestRestTemplate rest;

    @Test
    void 관리자_조회는_인증_없이_열리지_않는다() {
        for (String path : new String[] {"/api/admin/services", "/api/admin/articles", "/api/admin/blog/posts"}) {
            ResponseEntity<String> response = rest.getForEntity(path, String.class);
            assertThat(response.getStatusCode())
                    .as("인증 없는 GET %s", path)
                    .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        }
    }

    @Test
    void 로그인_시도도_횟수_제한을_받는다() {
        HttpEntity<Map<String, String>> attempt =
                new HttpEntity<>(Map.of("username", "admin", "password", "wrong-password"));

        HttpStatus last = null;
        for (int i = 0; i < 6; i++) {
            last = (HttpStatus) rest.exchange("/api/auth/login", HttpMethod.POST, attempt, String.class)
                    .getStatusCode();
        }
        // 제한이 없으면 계속 401 이 나온다. 429 가 나와야 막힌 것이다.
        assertThat(last).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void 기능마다_제한_통이_따로다() {
        // 로그인 통을 비워도 게시판 쓰기는 살아 있어야 한다. 통을 합치면 서로를 잠근다.
        HttpEntity<Map<String, String>> attempt =
                new HttpEntity<>(Map.of("username", "admin", "password", "wrong-password"));
        for (int i = 0; i < 6; i++) {
            rest.exchange("/api/auth/login", HttpMethod.POST, attempt, String.class);
        }

        ResponseEntity<String> post = rest.exchange(
                "/api/board/posts", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "title", "bucket-check",
                        "content", "본문",
                        "authorName", "테스터",
                        "password", "")),
                String.class);
        assertThat(post.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
