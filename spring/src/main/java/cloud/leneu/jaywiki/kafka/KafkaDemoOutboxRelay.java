package cloud.leneu.jaywiki.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
public class KafkaDemoOutboxRelay {
    /** 발행 대기 상한(5초)보다 넉넉히 잡는다. 이보다 오래 CLAIMED 면 선점자가 죽은 것으로 본다. */
    private static final String CLAIM_TIMEOUT = "60 seconds";

    private final JdbcTemplate jdbcTemplate;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final KafkaDemoProperties properties;
    private final KafkaDemoEventService eventService;
    private final KafkaDemoMetrics metrics;
    private final ObjectMapper objectMapper;

    /**
     * 두 단계로 나눈다. 먼저 처리할 행을 CLAIMED 로 선점하고, Kafka 발행은 그 뒤에 한다.
     *
     * 선점이 없으면 relay 가 둘 이상 돌 때 같은 행을 둘 다 읽어 중복 발행한다.
     * replica 가 1개인 동안에는 드러나지 않지만 HPA 가 2로 늘리는 순간 터진다.
     *
     * 선점을 for update skip locked 로 감싼 update ... returning 한 문장으로 처리해서,
     * 확인과 표시 사이에 다른 relay 가 끼어들 수 없게 했다. skip locked 는 이미 잠긴 행을
     * 기다리지 않고 건너뛰므로 두 relay 가 서로 다른 행을 가져간다.
     *
     * 발행을 선점 트랜잭션 안에 넣지 않는 것이 중요하다. Kafka send 는 최대 5초를 기다리는데
     * 그동안 행 잠금과 DB connection 을 쥐고 있게 된다. 외부 호출은 트랜잭션 밖에 둔다.
     */
    @Scheduled(fixedDelayString = "${app.kafka-demo.relay-delay:2s}")
    public void publishPending() {
        claimPending().forEach(this::publish);
    }

    /**
     * status = 'NEW' 인 행과, 선점해 놓고 CLAIMED_TIMEOUT 이 지나도록 끝나지 않은 행을 함께 집는다.
     * 후자는 선점한 프로세스가 발행 전에 죽은 경우다. 되돌려 줄 주체가 없으므로 시간으로 판별한다.
     */
    private List<OutboxRow> claimPending() {
        return jdbcTemplate.query("""
                update public.tb_outbox_event
                set status = 'CLAIMED',
                    claimed_at = now()
                where id in (
                    select id
                    from public.tb_outbox_event
                    where aggregate_type = 'KAFKA_DEMO_ORDER'
                      and event_type = 'ORDER_CREATED'
                      and (status = 'NEW'
                           or (status = 'CLAIMED' and claimed_at < now() - ?::interval))
                    order by created_at
                    limit 10
                    for update skip locked
                )
                returning id, aggregate_id, payload::text
                """, this::row, CLAIM_TIMEOUT);
    }

    private OutboxRow row(ResultSet rs, int rowNum) throws SQLException {
        return new OutboxRow(rs.getLong("id"), rs.getString("aggregate_id"), rs.getString("payload"));
    }

    void publish(OutboxRow row) {
        try {
            KafkaDemoOrderEvent event = objectMapper.readValue(row.payload(), KafkaDemoOrderEvent.class);
            kafkaTemplate.send(properties.orderTopic(), event.orderId(), row.payload())
                    .get(5, TimeUnit.SECONDS);
            jdbcTemplate.update("""
                    update public.tb_outbox_event
                    set status = 'PUBLISHED',
                        published_at = now(),
                        attempt_count = attempt_count + 1,
                        last_error = null
                    where id = ?
                    """, row.id());
            metrics.outboxPublished();
            eventService.markPublished(row.aggregateId());
        } catch (JsonProcessingException | InterruptedException | ExecutionException | TimeoutException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            // 선점만 해두고 실패했으므로 NEW 로 되돌린다. 그러지 않으면 CLAIMED 로 남아
            // 다음 폴링이 다시 집지 못하고 영원히 발행되지 않는다.
            jdbcTemplate.update("""
                    update public.tb_outbox_event
                    set status = 'NEW',
                        attempt_count = attempt_count + 1,
                        last_error = ?
                    where id = ?
                    """, e.getMessage(), row.id());
            metrics.outboxPublishFailed();
        }
    }

    record OutboxRow(long id, String aggregateId, String payload) {
    }
}
