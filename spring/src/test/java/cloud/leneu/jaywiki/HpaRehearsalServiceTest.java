package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.ops.HpaRehearsalGateway;
import cloud.leneu.jaywiki.ops.HpaRehearsalService;
import cloud.leneu.jaywiki.ops.HpaRuntimeSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HpaRehearsalServiceTest {
    private HpaRehearsalGateway gateway;
    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        gateway = mock(HpaRehearsalGateway.class);
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(redis.opsForHash()).thenReturn(mock(HashOperations.class));
        when(redis.opsForList()).thenReturn(mock(ListOperations.class));
    }

    @Test
    void 실행중인_리허설이_있으면_새_job을_만들지_않는다() {
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);
        HpaRehearsalService service = service();

        assertThatThrownBy(() -> service.start(true, 8))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already running");
        verify(gateway, never()).start(anyString(), anyInt());
    }

    @Test
    void 로컬_cluster가_없으면_unavailable을_명시한다() {
        when(values.get(anyString())).thenReturn(null);
        when(gateway.read(null)).thenReturn(HpaRuntimeSnapshot.unavailable());

        var view = service().current(false);

        assertThat(view.status()).isEqualTo("UNAVAILABLE");
        assertThat(view.available()).isFalse();
        assertThat(view.canControl()).isFalse();
    }

    private HpaRehearsalService service() {
        return new HpaRehearsalService(gateway, redis, new ObjectMapper());
    }
}
