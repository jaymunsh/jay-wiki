package cloud.leneu.jaywiki.saga;

import java.time.OffsetDateTime;

public record SagaStepDto(
        String name,
        String status,
        boolean compensating,
        String message,
        OffsetDateTime createdAt,
        String actor
) {
    static SagaStepDto from(SagaStep step) {
        return new SagaStepDto(step.getStepName(), step.getStatus(), step.isCompensating(),
                step.getMessage(), step.getCreatedAt(), step.getActor());
    }
}
