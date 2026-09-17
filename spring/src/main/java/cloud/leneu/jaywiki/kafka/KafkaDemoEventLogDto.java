package cloud.leneu.jaywiki.kafka;

import java.time.OffsetDateTime;

public record KafkaDemoEventLogDto(
        String stage,
        String status,
        String message,
        OffsetDateTime createdAt
) {
    static KafkaDemoEventLogDto from(KafkaDemoEventLog log) {
        return new KafkaDemoEventLogDto(log.getStage(), log.getStatus(), log.getMessage(), log.getCreatedAt());
    }
}
