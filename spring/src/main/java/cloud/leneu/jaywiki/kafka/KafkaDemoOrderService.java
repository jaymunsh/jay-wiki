package cloud.leneu.jaywiki.kafka;

import cloud.leneu.jaywiki.common.NotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KafkaDemoOrderService {
    private final KafkaDemoOrderRepository orderRepo;
    private final KafkaDemoEventLogRepository logRepo;
    private final KafkaDemoConsumerResultRepository resultRepo;
    private final KafkaDemoEventService eventService;
    private final KafkaDemoProperties properties;
    private final KafkaDemoMetrics metrics;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public KafkaDemoOrderView create(KafkaDemoCreateOrderRequest request) {
        OffsetDateTime now = OffsetDateTime.now();
        KafkaDemoOrder order = new KafkaDemoOrder();
        order.setId("kord_" + UUID.randomUUID().toString().replace("-", ""));
        order.setProductCode(request.productCode());
        order.setQuantity(request.quantity());
        order.setFailMode(request.failMode().name());
        order.setStatus("ACCEPTED");
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        orderRepo.save(order);
        metrics.orderCreated(request.failMode());
        eventService.log(order.getId(), "ORDER_ACCEPTED", "SUCCESS", "Kafka demo order row created");
        recordOutbox(order);
        eventService.log(order.getId(), "OUTBOX_RECORDED", "SUCCESS", "ORDER_CREATED event recorded in outbox");
        return view(order);
    }

    @Transactional(readOnly = true)
    public KafkaDemoOrderView get(String orderId) {
        return view(orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("kafka demo order not found: " + orderId)));
    }

    @Transactional(readOnly = true)
    public List<KafkaDemoOrderView> recent(int size) {
        return orderRepo.findTop20ByOrderByCreatedAtDesc().stream()
                .limit(Math.max(1, Math.min(size, 20)))
                .map(this::view)
                .toList();
    }

    private void recordOutbox(KafkaDemoOrder order) {
        KafkaDemoOrderEvent event = new KafkaDemoOrderEvent(
                order.getId(),
                order.getProductCode(),
                order.getQuantity(),
                KafkaDemoFailMode.valueOf(order.getFailMode()));
        jdbcTemplate.update("""
                insert into public.tb_outbox_event
                    (aggregate_type, aggregate_id, event_type, payload, status, created_at)
                values ('KAFKA_DEMO_ORDER', ?, 'ORDER_CREATED', ?::jsonb, 'NEW', now())
                """, order.getId(), write(event));
    }

    private KafkaDemoOrderView view(KafkaDemoOrder order) {
        List<KafkaDemoEventLogDto> events = logRepo.findByOrderIdOrderByIdAsc(order.getId()).stream()
                .map(KafkaDemoEventLogDto::from)
                .toList();
        List<KafkaDemoConsumerResultDto> consumers = resultRepo.findByOrderIdOrderByConsumerNameAsc(order.getId()).stream()
                .map(KafkaDemoConsumerResultDto::from)
                .toList();
        return new KafkaDemoOrderView(
                order.getId(),
                order.getProductCode(),
                order.getQuantity(),
                order.getFailMode(),
                order.getStatus(),
                order.getCreatedAt(),
                new KafkaDemoOrderView.KafkaState(properties.enabled(), properties.orderTopic(), properties.dlqTopic()),
                events,
                consumers);
    }

    private String write(KafkaDemoOrderEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("kafka demo outbox payload serialize failed", e);
        }
    }
}
