package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.auth.AdminTotpService;
import dev.samstevens.totp.code.CodeVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminTotpServiceTest {
    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private CodeVerifier verifier;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        verifier = mock(CodeVerifier.class);
        when(redis.opsForValue()).thenReturn(values);
    }

    @Test
    void 비활성화된_로컬에서는_otp를_요구하지_않는다() {
        AdminTotpService service = service(false);
        assertThat(service.verify(null, "local")).isEqualTo(AdminTotpService.Result.DISABLED);
    }

    @Test
    void 올바른_코드는_한번만_사용할수_있다() {
        when(values.increment(anyString())).thenReturn(1L, 1L);
        when(verifier.isValidCode("TESTSECRET", "123456")).thenReturn(true);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenReturn(true, false);
        AdminTotpService service = service(true);

        assertThat(service.verify("123456", "127.0.0.1")).isEqualTo(AdminTotpService.Result.VALID);
        assertThat(service.verify("123456", "127.0.0.1")).isEqualTo(AdminTotpService.Result.REPLAYED);
    }

    @Test
    void 제한을_넘긴_시도는_검증전에_차단한다() {
        when(values.increment(anyString())).thenReturn(6L);
        AdminTotpService service = service(true);
        assertThat(service.verify("123456", "127.0.0.1")).isEqualTo(AdminTotpService.Result.BLOCKED);
    }

    private AdminTotpService service(boolean enabled) {
        return new AdminTotpService(redis, verifier, enabled, "TESTSECRET", 5, Duration.ofMinutes(5));
    }
}
