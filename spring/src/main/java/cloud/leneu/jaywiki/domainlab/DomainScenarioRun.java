package cloud.leneu.jaywiki.domainlab;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_domain_scenario_run")
@Getter
@Setter
public class DomainScenarioRun {
    @Id
    private String runId;
    private String scenarioType;
    private String mode;
    private String status;
    private String headline;
    private int beforeAmount;
    private int afterAmount;
    private String idempotencyKey;
    private int httpStatus;
    private int attemptCount;
    private long elapsedMs;
    @Column(name = "p95_ms")
    private int p95Ms;
    private int rejectedCount;
    private int queueLag;
    private int replicas;
    private int recoverySeconds;
    private OffsetDateTime createdAt;
}
