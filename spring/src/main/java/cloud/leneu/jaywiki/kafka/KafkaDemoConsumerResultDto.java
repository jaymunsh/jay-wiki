package cloud.leneu.jaywiki.kafka;

import java.time.OffsetDateTime;

public record KafkaDemoConsumerResultDto(
        String consumerName,
        String status,
        int attemptCount,
        String lastError,
        OffsetDateTime updatedAt
) {
    static KafkaDemoConsumerResultDto from(KafkaDemoConsumerResult result) {
        return new KafkaDemoConsumerResultDto(
                result.getConsumerName(),
                result.getStatus(),
                result.getAttemptCount(),
                result.getLastError(),
                result.getUpdatedAt());
    }
}
