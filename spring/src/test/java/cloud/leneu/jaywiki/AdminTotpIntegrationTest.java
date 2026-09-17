package cloud.leneu.jaywiki;

import dev.samstevens.totp.code.DefaultCodeGenerator;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.opensearch.enabled=false",
        "app.admin.totp.enabled=true",
        "app.admin.totp.secret=BP26TDZUZ5SVPZJRIHCAUVREO5EWMHHV" // gitleaks:allow -- isolated test fixture
})
@Import(TestcontainersConfiguration.class)
class AdminTotpIntegrationTest {
    private static final String SECRET = "BP26TDZUZ5SVPZJRIHCAUVREO5EWMHHV"; // gitleaks:allow -- isolated test fixture
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};

    @Autowired
    TestRestTemplate rest;

    @Test
    void 관리자는_비밀번호와_otp가_모두_맞아야_로그인한다() throws Exception {
        ResponseEntity<Map<String, Object>> missing = login(null);
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(missing.getBody().get("code")).isEqualTo("OTP_REQUIRED");

        long counter = System.currentTimeMillis() / 1000 / 30;
        String code = new DefaultCodeGenerator().generate(SECRET, counter);
        ResponseEntity<Map<String, Object>> valid = login(code);
        assertThat(valid.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(valid.getBody().get("role")).isEqualTo("ADMIN");

        ResponseEntity<Map<String, Object>> replay = login(code);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(replay.getBody().get("code")).isEqualTo("OTP_INVALID");
    }

    private ResponseEntity<Map<String, Object>> login(String otp) {
        Map<String, String> body = new java.util.HashMap<>();
        body.put("username", "admin");
        body.put("password", "admin1234");
        if (otp != null) body.put("otp", otp);
        return rest.exchange("/api/auth/admin-login", HttpMethod.POST, new HttpEntity<>(body), MAP);
    }
}
