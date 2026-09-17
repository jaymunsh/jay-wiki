package cloud.leneu.jaywiki.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
public class KafkaDemoConsumers {
    private final KafkaDemoEventService eventService;
    private final KafkaDemoMetrics metrics;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "${app.kafka-demo.order-topic}",
            groupId = "${app.kafka-demo.group-prefix}-inventory",
            containerFactory = "kafkaDemoListenerContainerFactory")
    public void inventory(String payload) {
        long startedAt = metrics.start();
        String status = "SUCCESS";
        KafkaDemoOrderEvent event = read(payload);
        try {
            eventService.recordAttempt(event.orderId(), KafkaDemoConsumerName.INVENTORY);
            eventService.recordSuccess(
                    event.orderId(),
                    KafkaDemoConsumerName.INVENTORY,
                    "INVENTORY_CONSUMED",
                    "Inventory projection reserved " + event.quantity() + " item(s)");
        } catch (RuntimeException e) {
            status = "FAILED";
            throw e;
        } finally {
            metrics.consumerProcessing(KafkaDemoConsumerName.INVENTORY, status, startedAt);
        }
    }

    @KafkaListener(
            topics = "${app.kafka-demo.order-topic}",
            groupId = "${app.kafka-demo.group-prefix}-notification",
            containerFactory = "kafkaDemoListenerContainerFactory")
    public void notification(String payload) {
        long startedAt = metrics.start();
        String status = "SUCCESS";
        KafkaDemoOrderEvent event = read(payload);
        try {
            int attempt = eventService.recordAttempt(event.orderId(), KafkaDemoConsumerName.NOTIFICATION);
            if (event.failMode() == KafkaDemoFailMode.NOTIFICATION_RETRY && attempt == 1) {
                String message = "Notification consumer failed once by demo option";
                eventService.recordRetry(event.orderId(), KafkaDemoConsumerName.NOTIFICATION, message);
                status = "RETRY";
                throw new KafkaDemoConsumerException(message);
            }
            if (event.failMode() == KafkaDemoFailMode.NOTIFICATION_ALWAYS_FAIL) {
                String message = "Notification consumer forced to fail until DLQ";
                eventService.recordRetry(event.orderId(), KafkaDemoConsumerName.NOTIFICATION, message);
                status = "RETRY";
                throw new KafkaDemoConsumerException(message);
            }
            eventService.recordSuccess(
                    event.orderId(),
                    KafkaDemoConsumerName.NOTIFICATION,
                    "NOTIFICATION_CONSUMED",
                    "Order notification sent");
        } catch (RuntimeException e) {
            if (!"RETRY".equals(status)) {
                status = "FAILED";
            }
            throw e;
        } finally {
            metrics.consumerProcessing(KafkaDemoConsumerName.NOTIFICATION, status, startedAt);
        }
    }

    @KafkaListener(
            topics = "${app.kafka-demo.order-topic}",
            groupId = "${app.kafka-demo.group-prefix}-analytics",
            containerFactory = "kafkaDemoListenerContainerFactory")
    public void analytics(String payload) {
        long startedAt = metrics.start();
        String status = "SUCCESS";
        KafkaDemoOrderEvent event = read(payload);
        try {
            eventService.recordAttempt(event.orderId(), KafkaDemoConsumerName.ANALYTICS);
            eventService.recordSuccess(
                    event.orderId(),
                    KafkaDemoConsumerName.ANALYTICS,
                    "ANALYTICS_CONSUMED",
                    "Analytics projection counted the order");
        } catch (RuntimeException e) {
            status = "FAILED";
            throw e;
        } finally {
            metrics.consumerProcessing(KafkaDemoConsumerName.ANALYTICS, status, startedAt);
        }
    }

    @KafkaListener(
            topics = "${app.kafka-demo.dlq-topic}",
            groupId = "${app.kafka-demo.group-prefix}-dlq",
            containerFactory = "kafkaDemoListenerContainerFactory")
    public void dlq(ConsumerRecord<String, String> record) {
        long startedAt = metrics.start();
        KafkaDemoOrderEvent event = read(record.value());
        try {
            eventService.recordDlq(
                    event.orderId(),
                    KafkaDemoConsumerName.NOTIFICATION,
                    "Notification event moved to DLQ topic " + record.topic());
        } finally {
            metrics.consumerProcessing(KafkaDemoConsumerName.NOTIFICATION, "DLQ", startedAt);
        }
    }

    private KafkaDemoOrderEvent read(String payload) {
        try {
            return objectMapper.readValue(payload, KafkaDemoOrderEvent.class);
        } catch (JsonProcessingException e) {
            throw new KafkaDemoConsumerException("Kafka demo payload parse failed", e);
        }
    }
}
