package cloud.leneu.jaywiki.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT 발급/검증. HS256 서명, USER 6시간·ADMIN 1시간.
 * 시크릿은 app.jwt.secret (기본값은 로컬용. 배포 시 반드시 교체).
 */
@Service
public class JwtService {

    private final SecretKey key;
    private static final long USER_EXP_MILLIS = 6 * 60 * 60 * 1000L;
    private static final long ADMIN_EXP_MILLIS = 60 * 60 * 1000L;

    public JwtService(@Value("${app.jwt.secret:jaywiki-local-dev-secret-change-me-please-32bytes+}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** username + role 을 담은 토큰 발급. */
    public String issue(String username, String role) {
        Date now = new Date();
        long expiration = "ADMIN".equals(role) ? ADMIN_EXP_MILLIS : USER_EXP_MILLIS;
        String audience = "ADMIN".equals(role) ? "jaywiki-admin" : "jaywiki-public";
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(username)
                .claim("role", role)
                .audience().add(audience).and()
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiration))
                .signWith(key)
                .compact();
    }

    /** 유효하면 Claims, 아니면 null. */
    public Claims parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            String role = claims.get("role", String.class);
            var audiences = claims.getAudience();
            if ("ADMIN".equals(role) && audiences != null && audiences.contains("jaywiki-admin")) return claims;
            if ("USER".equals(role) && audiences != null && audiences.contains("jaywiki-public")) return claims;
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    public long getExpSeconds(String role) {
        return ("ADMIN".equals(role) ? ADMIN_EXP_MILLIS : USER_EXP_MILLIS) / 1000;
    }
}
