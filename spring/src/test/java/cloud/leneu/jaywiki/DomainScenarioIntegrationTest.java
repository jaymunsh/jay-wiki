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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.opensearch.enabled=false", "app.kafka-demo.enabled=false"})
@Import(TestcontainersConfiguration.class)
class DomainScenarioIntegrationTest {
    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void 상품권_리허설은_실행과_단계를_PostgreSQL에_보존한다() {
        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/domain-scenarios/gift-card/runs",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("mode", "DUPLICATE_RETRY")),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body.get("status")).isEqualTo("IDEMPOTENT");
        assertThat(body.get("afterAmount")).isEqualTo(40_000);
        assertThat(actions(body)).containsExactly(
                "ISSUED", "USE_REQUESTED", "BALANCE_DEBITED", "RETRY_RECEIVED", "DUPLICATE_RETURNED");

        Integer stepCount = jdbc.queryForObject(
                "select count(*) from public.tb_domain_scenario_step where run_id = ?",
                Integer.class,
                body.get("runId"));
        assertThat(stepCount).isEqualTo(5);
    }

    @Test
    void 트래픽_리허설은_RPS와_lag_복구지표를_PostgreSQL에_보존한다() {
        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/domain-scenarios/traffic-burst/runs",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("mode", "QUEUE_BUFFER")),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body.get("status")).isEqualTo("BUFFERED");
        assertThat(body.get("beforeAmount")).isEqualTo(600);
        assertThat(body.get("afterAmount")).isEqualTo(240);
        assertThat(body.get("queueLag")).isEqualTo(360);
        assertThat(body.get("recoverySeconds")).isEqualTo(90);

        Map<String, Object> persisted = jdbc.queryForMap(
                "select p95_ms, queue_lag, recovery_seconds from public.tb_domain_scenario_run where run_id = ?",
                body.get("runId"));
        assertThat(persisted.get("p95_ms")).isEqualTo(210);
        assertThat(persisted.get("queue_lag")).isEqualTo(360);
        assertThat(persisted.get("recovery_seconds")).isEqualTo(90);
    }

    @Test
    void 실무_트러블슈팅_리허설_4종은_실행결과를_PostgreSQL에_보존한다() {
        Map<String, String> modes = Map.of(
                "coupon-race", "CONDITIONAL_UPDATE",
                "settlement-batch", "CHECKPOINT_RESUME",
                "connection-pool", "BOUNDARY_SPLIT",
                "n-plus-one", "PROJECTION");

        for (var scenario : modes.entrySet()) {
            ResponseEntity<Map<String, Object>> response = rest.exchange(
                    "/api/domain-scenarios/" + scenario.getKey() + "/runs",
                    HttpMethod.POST,
                    new HttpEntity<>(Map.of("mode", scenario.getValue())),
                    MAP);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<String, Object> body = response.getBody();
            assertThat(body).containsKeys("runId", "status", "p95Ms", "steps");
            Integer runCount = jdbc.queryForObject(
                    "select count(*) from public.tb_domain_scenario_run where run_id = ? and scenario_type = ?",
                    Integer.class,
                    body.get("runId"),
                    scenario.getKey());
            assertThat(runCount).isEqualTo(1);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> actions(Map<String, Object> body) {
        List<Map<String, Object>> steps = (List<Map<String, Object>>) body.get("steps");
        return steps.stream().map(step -> (String) step.get("action")).toList();
    }
}
