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
 * payment-api 가 낸 사실을 받아 프로젝션에 반영한다.
 *
 * 프로젝션에 쓰는 유일한 곳이다. 사가 코드가 직접 고치면 사본이 원본을 앞질러 조용히 틀린다.
 *
 * 승인만 받고 취소를 빠뜨리면 화면이 취소된 결제를 AUTHORIZED 로 계속 보여준다. 그래서
 * event_type 으로 거르지 않고 payload 의 status 를 그대로 반영한다 — 새 상태가 생겨도 따라간다.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
public class PaymentEventConsumer {
    private static final Logger log = LoggerFactory.getLogger(PaymentEventConsumer.class);

    private final PaymentProjectionRepository projectionRepo;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "${app.payment-events.topic:jaywiki.payment-events}",
            groupId = "${app.payment-events.group:jaywiki-payment-projection}",
            containerFactory = "kafkaDemoListenerContainerFactory")
    @Transactional
    public void onPaymentEvent(String message) {
        JsonNode event = read(message);
        String orderId = event.path("orderId").asText(null);
        String paymentId = event.path("paymentId").asText(null);
        String status = event.path("status").asText(null);
        if (orderId == null || paymentId == null || status == null) {
            log.warn("payment event without required fields, skipped: {}", message);
            return;
        }

        OffsetDateTime occurredAt = occurredAt(event, message);
        PaymentProjection projection = projectionRepo.findById(orderId).orElseGet(() -> {
            PaymentProjection created = new PaymentProjection();
            created.setOrderId(orderId);
            return created;
        });

        // 늦게 도착한 과거 이벤트로 되돌아가지 않는다. Kafka 는 파티션 안에서만 순서를 지키고,
        // 재시도가 섞이면 승인이 취소보다 뒤에 올 수 있다.
        if (projection.getOccurredAt() != null && projection.getOccurredAt().isAfter(occurredAt)) {
            log.debug("stale payment event ignored: order={} occurredAt={}", orderId, occurredAt);
            return;
        }

        projection.setPaymentId(paymentId);
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
            log.warn("payment event has unreadable occurredAt, using now: {}", message);
            return OffsetDateTime.now();
        }
    }

    private JsonNode read(String message) {
        try {
            return objectMapper.readTree(message);
        } catch (Exception e) {
            throw new IllegalArgumentException("payment event is not json: " + message, e);
        }
    }
}
