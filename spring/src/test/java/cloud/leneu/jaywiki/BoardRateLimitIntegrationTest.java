package cloud.leneu.jaywiki;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                                "app.board.rate-limit.enabled=true",
                "app.board.rate-limit.capacity=2",
                "app.board.rate-limit.window=1m"
        })
@Import(TestcontainersConfiguration.class)
class BoardRateLimitIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    @Test
    void 회원가입도_요청_제한을_적용한다() {
        var headers = new org.springframework.http.HttpHeaders();
        headers.set("cf-connecting-ip", "192.0.2.73");
        var payload = new HttpEntity<>(Map.of("username", "a", "password", "password123"), headers);
        assertThat(rest.postForEntity("/api/auth/register", payload, String.class).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(rest.postForEntity("/api/auth/register", payload, String.class).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(rest.postForEntity("/api/auth/register", payload, String.class).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void 익명_게시판_POST는_제한을_넘으면_429를_준다() {
        ResponseEntity<Map<String, Object>> first = rest.exchange(
                "/api/board/posts", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "title", "rate-limit-1",
                        "content", "본문",
                        "authorName", "테스터",
                        "password", "")),
                MAP);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);

        Long postId = ((Number) first.getBody().get("id")).longValue();
        ResponseEntity<Map<String, Object>> second = rest.exchange(
                "/api/board/posts/" + postId + "/comments", HttpMethod.POST,
                new HttpEntity<>(Map.of("content", "첫 댓글", "authorName", "테스터")),
                MAP);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> third = rest.exchange(
                "/api/board/posts/" + postId + "/comments", HttpMethod.POST,
                new HttpEntity<>(Map.of("content", "두 번째 댓글", "authorName", "테스터")),
                String.class);
        assertThat(third.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(third.getBody()).contains("rate-limit");
    }
}
