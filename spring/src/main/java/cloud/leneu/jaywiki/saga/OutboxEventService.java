package cloud.leneu.jaywiki.saga;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class OutboxEventService {
    private final JdbcTemplate jdbcTemplate;

    void record(String aggregateId, String eventType, String payloadJson) {
        jdbcTemplate.update("""
                insert into public.tb_outbox_event
                    (aggregate_type, aggregate_id, event_type, payload, status, created_at)
                values ('ORDER_SAGA', ?, ?, ?::jsonb, 'NEW', now())
                """, aggregateId, eventType, payloadJson);
    }
}
