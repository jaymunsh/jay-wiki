package cloud.leneu.jaywiki.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAudienceTest {
    private static final String SECRET = "audience-test-".repeat(3);
    private final JwtService jwt = new JwtService(SECRET);

    @Test
    void 역할에_맞는_audience를_발급하고_검증한다() {
        assertThat(jwt.parse(jwt.issue("admin", "ADMIN")).getAudience()).contains("jaywiki-admin");
        assertThat(jwt.parse(jwt.issue("member", "USER")).getAudience()).contains("jaywiki-public");
    }

    @Test
    void audience가_없는_기존_관리자_토큰은_재로그인을_요구한다() {
        Date now = new Date();
        String legacy = Jwts.builder()
                .subject("admin")
                .claim("role", "ADMIN")
                .issuedAt(now)
                .expiration(new Date(now.getTime() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(jwt.parse(legacy)).isNull();
    }
}
