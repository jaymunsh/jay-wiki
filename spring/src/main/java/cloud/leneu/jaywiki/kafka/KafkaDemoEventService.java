package cloud.leneu.jaywiki.kafka;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
class KafkaDemoEventService {
    private static final Set<String> REQUIRED_SUCCESS_CONSUMERS = Set.of(
            KafkaDemoConsumerName.INVENTORY,
            KafkaDemoConsumerName.NOTIFICATION,
            KafkaDemoConsumerName.ANALYTICS);

    private final KafkaDemoOrderRepository orderRepo;
    private final KafkaDemoEventLogRepository logRepo;
    private final KafkaDemoConsumerResultRepository resultRepo;
    private final KafkaDemoMetrics metrics;

    @Transactional
    public void log(String orderId, String stage, String status, String message) {
        KafkaDemoEventLog log = new KafkaDemoEventLog();
        log.setOrderId(orderId);
        log.setStage(stage);
        log.setStatus(status);
        log.setMessage(message);
        log.setCreatedAt(OffsetDateTime.now());
        logRepo.save(log);
    }

    @Transactional
    public void markPublished(String orderId) {
        orderRepo.findByIdForUpdate(orderId).ifPresent(order -> {
            if ("ACCEPTED".equals(order.getStatus())) {
                order.setStatus("PUBLISHED");
                order.setUpdatedAt(OffsetDateTime.now());
            }
        });
        log(orderId, "KAFKA_PUBLISHED", "SUCCESS", "ORDER_CREATED published to Kafka");
    }

    @Transactional
    public int recordAttempt(String orderId, String consumerName) {
        KafkaDemoConsumerResult result = result(orderId, consumerName);
        result.setAttemptCount(result.getAttemptCount() + 1);
        result.setStatus("RETRYING");
        result.setLastError(null);
        result.setUpdatedAt(OffsetDateTime.now());
        resultRepo.save(result);
        metrics.consumerAttempt(consumerName);
        return result.getAttemptCount();
    }

    @Transactional
    public void recordSuccess(String orderId, String consumerName, String stage, String message) {
        KafkaDemoConsumerResult result = result(orderId, consumerName);
        result.setStatus("SUCCESS");
        result.setLastError(null);
        result.setUpdatedAt(OffsetDateTime.now());
        resultRepo.save(result);
        metrics.consumerSuccess(consumerName);
        log(orderId, stage, "SUCCESS", message);
        completeIfReady(orderId);
    }

    @Transactional
    public void recordRetry(String orderId, String consumerName, String message) {
        KafkaDemoConsumerResult result = result(orderId, consumerName);
        result.setStatus("RETRYING");
        result.setLastError(message);
        result.setUpdatedAt(OffsetDateTime.now());
        resultRepo.save(result);
        metrics.consumerRetry(consumerName);
        log(orderId, "NOTIFICATION_RETRY", "FAILED", message);
    }

    @Transactional
    public void recordDlq(String orderId, String consumerName, String message) {
        KafkaDemoConsumerResult result = result(orderId, consumerName);
        result.setStatus("DLQ");
        result.setLastError(message);
        result.setUpdatedAt(OffsetDateTime.now());
        resultRepo.save(result);
        metrics.consumerDlq(consumerName);
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setStatus("FAILED");
            order.setUpdatedAt(OffsetDateTime.now());
        });
        log(orderId, "DLQ_SENT", "FAILED", message);
    }

    private KafkaDemoConsumerResult result(String orderId, String consumerName) {
        return resultRepo.findByOrderIdAndConsumerName(orderId, consumerName)
                .orElseGet(() -> {
                    KafkaDemoConsumerResult created = new KafkaDemoConsumerResult();
                    created.setOrderId(orderId);
                    created.setConsumerName(consumerName);
                    created.setStatus("NEW");
                    created.setAttemptCount(0);
                    created.setUpdatedAt(OffsetDateTime.now());
                    return created;
                });
    }

    private void completeIfReady(String orderId) {
        orderRepo.findByIdForUpdate(orderId).ifPresent(order -> {
            boolean allSucceeded = resultRepo.findByOrderIdOrderByConsumerNameAsc(orderId).stream()
                    .filter(result -> REQUIRED_SUCCESS_CONSUMERS.contains(result.getConsumerName()))
                    .filter(result -> "SUCCESS".equals(result.getStatus()))
                    .count() == REQUIRED_SUCCESS_CONSUMERS.size();
            if (!allSucceeded) {
                return;
            }
            if (!"FAILED".equals(order.getStatus())) {
                order.setStatus("COMPLETED");
                order.setUpdatedAt(OffsetDateTime.now());
            }
        });
    }
}
