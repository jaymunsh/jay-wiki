package cloud.leneu.jaywiki.kafka;

import java.time.OffsetDateTime;
import java.util.List;

public record KafkaDemoOrderView(
        String orderId,
        String productCode,
        int quantity,
        String failMode,
        String status,
        OffsetDateTime createdAt,
        KafkaState kafka,
        List<KafkaDemoEventLogDto> events,
        List<KafkaDemoConsumerResultDto> consumers
) {
    public record KafkaState(
            boolean enabled,
            String orderTopic,
            String dlqTopic
    ) {
    }
}
