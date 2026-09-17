package cloud.leneu.jaywiki.auth;

import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class TokenRevocations {
    private final StringRedisTemplate redis;
    public TokenRevocations(@Qualifier("securityRedisTemplate") StringRedisTemplate redis) { this.redis = redis; }

    public boolean isRevoked(String token) {
        // A connection error propagates: no authentication is granted on a failed lookup.
        Boolean exists = redis.hasKey(key(token));
        if (exists == null) throw new IllegalStateException("Revocation lookup returned no result");
        return exists;
    }

    public void revoke(String token, Claims claims) {
        Duration remaining = Duration.between(Instant.now(), claims.getExpiration().toInstant());
        if (!remaining.isNegative() && !remaining.isZero()) {
            redis.opsForValue().set(key(token), "1", remaining);
        }
    }

    private static String key(String token) {
        try {
            return "auth:jwt:revoked:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
