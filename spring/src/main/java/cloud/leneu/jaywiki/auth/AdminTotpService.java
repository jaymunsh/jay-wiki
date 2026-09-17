package cloud.leneu.jaywiki.auth;

import dev.samstevens.totp.code.CodeVerifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;

@Service
public class AdminTotpService {
    public enum Result { DISABLED, VALID, MISSING, INVALID, REPLAYED, BLOCKED }

    private static final Duration USED_CODE_TTL = Duration.ofSeconds(90);
    private final StringRedisTemplate redis;
    private final CodeVerifier verifier;
    private final boolean enabled;
    private final String secret;
    private final int maxAttempts;
    private final Duration attemptWindow;

    public AdminTotpService(
            @Qualifier("securityRedisTemplate") StringRedisTemplate redis,
            CodeVerifier verifier,
            @Value("${app.admin.totp.enabled:false}") boolean enabled,
            @Value("${app.admin.totp.secret:}") String secret,
            @Value("${app.admin.totp.max-attempts:5}") int maxAttempts,
            @Value("${app.admin.totp.attempt-window:5m}") Duration attemptWindow) {
        if (enabled && (secret == null || secret.isBlank())) {
            throw new IllegalStateException("APP_ADMIN_TOTP_SECRET is required when admin TOTP is enabled");
        }
        this.redis = redis;
        this.verifier = verifier;
        this.enabled = enabled;
        this.secret = secret == null ? "" : secret.trim();
        this.maxAttempts = maxAttempts;
        this.attemptWindow = attemptWindow;
    }

    public boolean enabled() {
        return enabled;
    }

    public Result verify(String code, String clientKey) {
        if (!enabled) return Result.DISABLED;
        if (code == null || code.isBlank()) return Result.MISSING;

        String attemptsKey = "auth:admin:totp:attempts:" + digest(clientKey == null ? "unknown" : clientKey);
        Long attempts = redis.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts == 1L) redis.expire(attemptsKey, attemptWindow);
        if (attempts != null && attempts > maxAttempts) return Result.BLOCKED;

        String normalized = code.trim();
        if (!normalized.matches("\\d{6}") || !verifier.isValidCode(secret, normalized)) {
            return Result.INVALID;
        }
        String usedKey = "auth:admin:totp:used:" + digest(normalized);
        Boolean firstUse = redis.opsForValue().setIfAbsent(usedKey, "1", USED_CODE_TTL);
        if (!Boolean.TRUE.equals(firstUse)) return Result.REPLAYED;
        redis.delete(attemptsKey);
        return Result.VALID;
    }

    private static String digest(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
