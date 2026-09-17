package cloud.leneu.jaywiki;

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
import org.springframework.jdbc.core.JdbcTemplate;

import io.micrometer.core.instrument.MeterRegistry;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.opensearch.enabled=false", "app.kafka-demo.enabled=false"})
@Import(TestcontainersConfiguration.class)
class KafkaDemoIntegrationTest {
    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    MeterRegistry meterRegistry;

    @Test
    void 주문생성은_주문과_outbox를_같은_요청에서_기록한다() {
        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/kafka/orders",
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "productCode", "JAY-HOODIE",
                        "quantity", 1,
                        "failMode", "NOTIFICATION_RETRY")),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body.get("status")).isEqualTo("ACCEPTED");
        assertThat(body.get("failMode")).isEqualTo("NOTIFICATION_RETRY");
        assertThat(stageNames(body)).containsExactly("ORDER_ACCEPTED", "OUTBOX_RECORDED");

        Integer outboxCount = jdbcTemplate.queryForObject("""
                select count(*)
                from public.tb_outbox_event
                where aggregate_type = 'KAFKA_DEMO_ORDER'
                  and aggregate_id = ?
                  and event_type = 'ORDER_CREATED'
                  and status = 'NEW'
                """, Integer.class, body.get("orderId"));
        assertThat(outboxCount).isEqualTo(1);
        assertThat(meterRegistry.counter("jaywiki.kafka.orders",
                "status", "ACCEPTED",
                "fail_mode", "NOTIFICATION_RETRY").count()).isGreaterThanOrEqualTo(1.0);
    }

    @SuppressWarnings("unchecked")
    private List<String> stageNames(Map<String, Object> body) {
        List<Map<String, Object>> events = (List<Map<String, Object>>) body.get("events");
        return events.stream().map(event -> (String) event.get("stage")).toList();
    }
}
