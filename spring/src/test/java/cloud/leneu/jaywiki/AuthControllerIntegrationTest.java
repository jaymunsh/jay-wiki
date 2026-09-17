package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.account.AccountUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.opensearch.enabled=false"})
@Import(TestcontainersConfiguration.class)
class AuthControllerIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    AccountUserRepository users;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    @Test
    void 일반회원은_가입즉시_USER로_로그인된다() {
        String username = "user_" + System.nanoTime();

        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/auth/register",
                org.springframework.http.HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "username", username,
                        "password", "password123",
                        "nickname", "일반회원")),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("username")).isEqualTo(username);
        assertThat(response.getBody().get("displayName")).isEqualTo("일반회원");
        assertThat(response.getBody().get("role")).isEqualTo("USER");
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).contains("jw_token=");
        assertThat(users.findByUsername(username)).isPresent()
                .get()
                .satisfies(user -> {
                    assertThat(user.getRole()).isEqualTo("USER");
                    assertThat(user.getProvider()).isEqualTo("local");
                    assertThat(user.getPassword()).startsWith("$2");
                });
    }

    /**
     * 가입 화면의 Referer 는 로그인 화면 자신이라, 애초 유입 경로는 첫 방문 때 담아 둔
     * 세션 쿠키(jw_src)로만 이어진다. 그 쿠키가 실제로 계정까지 닿는지 고정한다.
     */
    @Test
    void 가입에_유입_경로가_함께_남는다() {
        String username = "user_" + System.nanoTime();
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, "jw_src=www.google.com");

        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/auth/register",
                org.springframework.http.HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "username", username,
                        "password", "password123",
                        "nickname", "검색으로 온 사람"), headers),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(users.findByUsername(username)).isPresent()
                .get()
                .satisfies(user -> assertThat(user.getSource()).isEqualTo("google"));
    }

    /** 쿠키가 없으면 direct 다. 빈 값이나 null 로 두면 화면에서 unknown 과 구별되지 않는다. */
    @Test
    void 쿠키가_없는_가입은_직접_유입으로_남는다() {
        String username = "user_" + System.nanoTime();

        rest.exchange(
                "/api/auth/register",
                org.springframework.http.HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "username", username,
                        "password", "password123",
                        "nickname", "그냥 온 사람")),
                MAP);

        assertThat(users.findByUsername(username)).isPresent()
                .get()
                .satisfies(user -> assertThat(user.getSource()).isEqualTo("direct"));
    }

    @Test
    void 중복아이디는_가입할수_없다() {
        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/auth/register",
                org.springframework.http.HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "username", "admin",
                        "password", "password123",
                        "nickname", "중복")),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("error")).asString().contains("이미 사용 중");
    }

    @Test
    void 관리자는_공개_로그인에서_거절되고_관리자_로그인에서만_인증된다() {
        ResponseEntity<Map<String, Object>> publicLogin = rest.exchange(
                "/api/auth/login",
                org.springframework.http.HttpMethod.POST,
                new HttpEntity<>(Map.of("username", "admin", "password", "admin1234")),
                MAP);
        assertThat(publicLogin.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(publicLogin.getBody().get("code")).isEqualTo("ADMIN_LOGIN_REQUIRED");

        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/auth/admin-login",
                org.springframework.http.HttpMethod.POST,
                new HttpEntity<>(Map.of("username", "admin", "password", "admin1234")),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("username")).isEqualTo("admin");
        assertThat(response.getBody().get("role")).isEqualTo("ADMIN");
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).contains("jw_token=");
    }

    @Test
    void 비로그인_사용자는_hpa_리허설을_실행할수_없다() {
        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/admin/rehearsals/hpa",
                org.springframework.http.HttpMethod.POST,
                HttpEntity.EMPTY,
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
