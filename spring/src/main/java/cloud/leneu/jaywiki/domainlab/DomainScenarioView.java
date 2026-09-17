package cloud.leneu.jaywiki.domainlab;

import java.time.OffsetDateTime;
import java.util.List;

public record DomainScenarioView(
        String runId,
        String scenario,
        String mode,
        String status,
        String headline,
        int beforeAmount,
        int afterAmount,
        String idempotencyKey,
        int httpStatus,
        int attemptCount,
        long elapsedMs,
        int p95Ms,
        int rejectedCount,
        int queueLag,
        int replicas,
        int recoverySeconds,
        OffsetDateTime createdAt,
        List<StepView> steps
) {
    public record StepView(int sequence, String action, String actor, String status, String detail) {
    }
}
