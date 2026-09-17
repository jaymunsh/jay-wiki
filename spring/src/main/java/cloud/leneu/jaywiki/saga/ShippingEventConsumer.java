package cloud.leneu.jaywiki.saga;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * shipping-api 가 낸 사실을 받아 프로젝션에 반영한다.
 *
 * PaymentEventConsumer 와 같은 규칙이다. 프로젝션에 쓰는 유일한 곳이고,
 * event_type 이 아니라 payload 의 status 를 그대로 반영한다 — 새 상태가 생겨도 따라간다.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
public class ShippingEventConsumer {
    private static final Logger log = LoggerFactory.getLogger(ShippingEventConsumer.class);

    private final ShippingProjectionRepository projectionRepo;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "${app.shipping-events.topic:jaywiki.shipping-events}",
            groupId = "${app.shipping-events.group:jaywiki-shipping-projection}",
            containerFactory = "kafkaDemoListenerContainerFactory")
    @Transactional
    public void onShippingEvent(String message) {
        JsonNode event = read(message);
        String orderId = event.path("orderId").asText(null);
        String shipmentId = event.path("shipmentId").asText(null);
        String status = event.path("status").asText(null);
        if (orderId == null || shipmentId == null || status == null) {
            log.warn("shipping event without required fields, skipped: {}", message);
            return;
        }

        OffsetDateTime occurredAt = occurredAt(event, message);
        ShippingProjection projection = projectionRepo.findById(orderId).orElseGet(() -> {
            ShippingProjection created = new ShippingProjection();
            created.setOrderId(orderId);
            return created;
        });

        // 늦게 도착한 과거 이벤트로 되돌아가지 않는다. Kafka 는 파티션 안에서만 순서를 지키고,
        // 재시도가 섞이면 순서가 뒤집힐 수 있다.
        if (projection.getOccurredAt() != null && projection.getOccurredAt().isAfter(occurredAt)) {
            log.debug("stale shipping event ignored: order={} occurredAt={}", orderId, occurredAt);
            return;
        }

        projection.setShipmentId(shipmentId);
        projection.setStatus(status);
        projection.setOccurredAt(occurredAt);
        projection.setObservedAt(OffsetDateTime.now());
        projectionRepo.save(projection);
    }

    /** occurredAt 이 없거나 못 읽으면 지금으로 둔다. 이벤트를 버리는 것보다 낫다. */
    private OffsetDateTime occurredAt(JsonNode event, String message) {
        String raw = event.path("occurredAt").asText(null);
        if (raw == null) return OffsetDateTime.now();
        try {
            return OffsetDateTime.parse(raw);
        } catch (RuntimeException e) {
            log.warn("shipping event has unreadable occurredAt, using now: {}", message);
            return OffsetDateTime.now();
        }
    }

    private JsonNode read(String message) {
        try {
            return objectMapper.readTree(message);
        } catch (Exception e) {
            throw new IllegalArgumentException("shipping event is not json: " + message, e);
        }
    }
}
