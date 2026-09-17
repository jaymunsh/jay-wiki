package cloud.leneu.jaywiki.saga;

import cloud.leneu.jaywiki.common.NotFoundException;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Saga 의 각 단계를 "짧은 로컬 트랜잭션" 으로 끊어 놓은 곳이다.
 *
 * 이 클래스를 따로 둔 이유가 둘이다.
 *
 * 1. 외부 결제 호출을 트랜잭션 밖으로 빼기 위해서다. 예전에는 run() 전체가 하나의 @Transactional
 *    이라 결제 서비스 응답을 기다리는 동안 DB connection 을 쥐고 있었다. 결제가 느려지면 그만큼
 *    connection 이 묶이고, 그런 요청이 쌓이면 결제와 무관한 요청까지 pool 을 못 받는다.
 *    (도메인 랩의 "DB Connection Pool 고갈" 시나리오가 경고하는 바로 그 패턴이었다.)
 *
 * 2. 단계마다 커밋해야 보상이 실제 의미를 갖는다. 전부 한 트랜잭션이면 예외가 나는 순간 통째로
 *    롤백돼서 보상 로직이 사실상 죽은 코드가 된다. Saga 는 각 단계가 이미 커밋됐다는 전제 위에
 *    성립한다.
 *
 * Spring 프록시는 자기 자신의 메서드 호출에는 트랜잭션을 걸지 못하므로 별도 빈이어야 한다.
 */
@Service
@RequiredArgsConstructor
public class OrderSagaSteps {
    static final int UNIT_AMOUNT_CENTS = 49_000;

    /**
     * 이보다 오래 STARTED 인 사가는 아무도 이어받지 못한 것으로 본다.
     *
     * <p>정상 사가는 수십 ms 안에 끝난다. graceful shutdown 이 처리 중 요청을 20초까지
     * 기다리므로 배포로는 잘 안 생기고, OOM 이나 노드 정지처럼 프로세스가 갑자기 사라질 때
     * 남는다. 10분은 그 둘을 가르기에 충분히 길다.
     */
    private static final Duration ORPHAN_AFTER = Duration.ofMinutes(10);

    private final SagaOrderRepository orderRepo;
    private final SagaInventoryRepository inventoryRepo;
    private final SagaCustomerRepository customerRepo;
    private final PaymentProjectionRepository paymentProjectionRepo;
    private final ShippingProjectionRepository shippingProjectionRepo;
    private final SagaInstanceRepository sagaRepo;
    private final SagaStepRepository stepRepo;
    private final OutboxEventService outbox;
    private final MeterRegistry meterRegistry;

    /**
     * 이어받지 못한 사가를 세어 둔다. 자동 복구는 하지 않는다 — 파드가 둘이라 같은 사가를
     * 동시에 집는 경합을 먼저 풀어야 하고, 그건 이 상태가 실제로 한 번이라도 생긴 뒤에 할 일이다.
     * 지금 필요한 것은 생겼는지조차 모르는 상태를 벗어나는 것이다.
     */
    @PostConstruct
    void registerOrphanGauge() {
        Gauge.builder("jaywiki.saga.orphaned", this, OrderSagaSteps::orphanedCount)
                .description("STARTED 인 채 " + ORPHAN_AFTER.toMinutes() + "분이 지난 사가 수")
                .register(meterRegistry);
    }

    double orphanedCount() {
        return sagaRepo.countByStatusAndCreatedAtBefore("STARTED", OffsetDateTime.now().minus(ORPHAN_AFTER));
    }

    /** 같은 멱등키로 이미 실행된 saga 가 있으면 새로 실행하지 않고 그 결과를 그대로 돌려준다. */
    @Transactional(readOnly = true)
    public Optional<OrderSagaView> findByIdempotencyKey(String idempotencyKey) {
        return orderRepo.findByIdempotencyKey(idempotencyKey)
                .flatMap(order -> sagaRepo.findByOrderId(order.getId()))
                .map(this::view);
    }

    @Transactional(readOnly = true)
    public OrderSagaView get(String sagaId) {
        return view(sagaRepo.findById(sagaId)
                .orElseThrow(() -> new NotFoundException("saga not found: " + sagaId)));
    }

    @Transactional(readOnly = true)
    public List<OrderSagaView.CustomerState> customers() {
        return customerRepo.findAllByOrderByNameAsc().stream()
                .map(c -> new OrderSagaView.CustomerState(c.getId(), c.getName(), c.getGrade()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderSagaView> recent(int size) {
        return sagaRepo.findTop20ByOrderByCreatedAtDesc().stream()
                .limit(Math.max(1, Math.min(size, 20)))
                .map(this::view)
                .toList();
    }

    /**
     * 주문 생성과 재고 예약. 둘 다 우리 DB 안이라 한 트랜잭션으로 묶는 것이 맞다.
     * 재고가 모자라면 예외가 전파돼 주문 행까지 함께 롤백된다 — 시작도 못 한 saga 를 남기지 않는다.
     */
    @Transactional
    public Started start(OrderSagaRequest request) {
        OffsetDateTime now = OffsetDateTime.now();
        SagaOrder order = createOrder(request, now);
        SagaInstance saga = createSaga(order, request.failAt(), now);
        log(saga, "ORDER_CREATED", "SUCCESS", false, "Order row created");

        if (request.failAt() == OrderSagaFailAt.INVENTORY_RESERVE) {
            log(saga, "INVENTORY_RESERVED", "FAILED", false, "Inventory failure injected");
            failOrder(order, saga, "INVENTORY_RESERVED");
            return Started.terminal(finish(saga, request.failAt(), "FAILED"));
        }

        reserveInventory(request.productCode(), request.quantity());
        log(saga, "INVENTORY_RESERVED", "SUCCESS", false, "Inventory reserved");
        return Started.running(saga.getId(), order.getId());
    }

    @Transactional
    public void recordPaymentAuthorized(Started started, String servedBy) {
        SagaInstance saga = saga(started.sagaId());
        // 결제 상태는 여기서 저장하지 않는다. 원본은 payment-api 의 DB 에 있고,
        // 화면이 읽는 사본은 그쪽 이벤트로 채워진다(tb_payment_projection).
        // 사가가 남기는 것은 "이 단계가 성공했다" 는 기록뿐이다.
        log(saga, "PAYMENT_AUTHORIZED", "SUCCESS", false, "Payment authorized", servedBy);
    }

    /** 결제 승인이 실패한 경우. 결제는 애초에 잡히지 않았으니 재고만 되돌린다. */
    @Transactional
    public OrderSagaView compensateAfterPaymentFailure(Started started, OrderSagaRequest request,
                                                       String servedBy) {
        SagaInstance saga = saga(started.sagaId());
        log(saga, "PAYMENT_AUTHORIZED", "FAILED", false, "Payment failure injected", servedBy);
        releaseInventory(request.productCode(), request.quantity());
        log(saga, "INVENTORY_RELEASED", "COMPENSATED", true, "Inventory reservation released");
        failOrder(order(started.orderId()), saga, "PAYMENT_AUTHORIZED");
        return finish(saga, request.failAt(), "FAILED");
    }

    /**
     * 배송 요청이 실패한 경우. 결제 취소는 외부 호출이라 이 트랜잭션 밖에서 이미 끝났고,
     * 여기서는 재고를 되돌린다.
     *
     * <p>취소된 상태를 여기서 쓰지 않는다. payment-api 가 자기 DB 에 쓰고 이벤트를 내면
     * 화면의 사본이 따라온다 — 그래서 취소 직후 잠깐은 화면에 AUTHORIZED 가 남는다.
     * 그 지연을 감추지 않는 것이 이 설계의 요지다.
     */
    @Transactional
    public OrderSagaView compensateAfterShippingFailure(Started started, OrderSagaRequest request,
                                                        String shippingServedBy, String cancelServedBy) {
        SagaInstance saga = saga(started.sagaId());
        log(saga, "SHIPPING_REQUESTED", "FAILED", false, "Shipping failure injected", shippingServedBy);
        meterRegistry.counter("jaywiki.saga.compensations", "step", "PAYMENT_CANCELLED").increment();
        log(saga, "PAYMENT_CANCELLED", "COMPENSATED", true, "Payment authorization cancelled", cancelServedBy);
        releaseInventory(request.productCode(), request.quantity());
        log(saga, "INVENTORY_RELEASED", "COMPENSATED", true, "Inventory reservation released");
        failOrder(order(started.orderId()), saga, "SHIPPING_REQUESTED");
        return finish(saga, request.failAt(), "FAILED");
    }

    /**
     * 참여자에 못 닿아서 멈춘 경우. 실패(접수 안 됨)와는 다른 상태다 — 접수됐는지 자체를 모른다.
     *
     * <p>모르는 것에 손대지 않고 <b>확실한 것만</b> 되돌린다. 확실한 것은 이 주문이 완료되지
     * 않았다는 사실이고, 그러면 모놀리스가 소유한 재고는 잡혀 있을 이유가 없다. 참여자 쪽
     * 원본은 그쪽 소유라 여기서 어떤 상태도 쓰지 않는다.
     *
     * <p>이걸 안 하면 재고가 잡힌 채로 남는다. 2026-08-18 로컬에서 payment-api 를 죽이고
     * 실제로 그렇게 났다 — reserved 가 0에서 1로 가고 아무도 풀지 않았다.
     */
    @Transactional
    public void compensateAfterParticipantUnavailable(
            Started started, OrderSagaRequest request, String failedStep) {
        SagaInstance saga = saga(started.sagaId());
        log(saga, failedStep, "FAILED", false, "Participant unavailable - outcome unknown");
        releaseInventory(request.productCode(), request.quantity());
        log(saga, "INVENTORY_RELEASED", "COMPENSATED", true, "Inventory reservation released");
        failOrder(order(started.orderId()), saga, failedStep);
        finish(saga, request.failAt(), "FAILED");
    }

    @Transactional
    public OrderSagaView confirm(Started started, OrderSagaRequest request, String servedBy) {
        SagaInstance saga = saga(started.sagaId());
        SagaOrder order = order(started.orderId());
        // 배송 접수는 여기서 저장하지 않는다. 원본은 shipping-api 의 DB 에 있고,
        // 화면이 읽는 사본은 그쪽 이벤트로 채워진다(tb_shipping_projection).
        log(saga, "SHIPPING_REQUESTED", "SUCCESS", false, "Shipment requested", servedBy);
        commitInventory(request.productCode(), request.quantity());
        order.setStatus("CONFIRMED");
        order.setUpdatedAt(OffsetDateTime.now());
        saga.setStatus("COMPLETED");
        saga.setCurrentStep("ORDER_CONFIRMED");
        saga.setCompletedAt(OffsetDateTime.now());
        log(saga, "ORDER_CONFIRMED", "SUCCESS", false, "Order confirmed");
        outbox.record(saga.getId(), "ORDER_SAGA_COMPLETED", "{\"status\":\"COMPLETED\"}");
        meterRegistry.counter("jaywiki.saga.runs",
                "status", "COMPLETED", "fail_at", request.failAt().name()).increment();
        return view(saga);
    }

    private SagaOrder createOrder(OrderSagaRequest request, OffsetDateTime now) {
        SagaOrder order = new SagaOrder();
        order.setId("ord_" + UUID.randomUUID().toString().replace("-", ""));
        order.setCustomerId(customerId(request.customerId()));
        order.setProductCode(request.productCode());
        order.setQuantity(request.quantity());
        order.setStatus("CREATED");
        order.setIdempotencyKey(request.idempotencyKey());
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return orderRepo.save(order);
    }

    private SagaInstance createSaga(SagaOrder order, OrderSagaFailAt failAt, OffsetDateTime now) {
        SagaInstance saga = new SagaInstance();
        saga.setId("saga_" + UUID.randomUUID().toString().replace("-", ""));
        saga.setOrderId(order.getId());
        saga.setStatus("STARTED");
        saga.setCurrentStep("ORDER_CREATED");
        saga.setFailAt(failAt.name());
        saga.setCreatedAt(now);
        return sagaRepo.save(saga);
    }

    private void reserveInventory(String productCode, int quantity) {
        SagaInventory inventory = inventory(productCode);
        if (inventory.getAvailable() < quantity) {
            throw new IllegalStateException("inventory is insufficient");
        }
        inventory.setAvailable(inventory.getAvailable() - quantity);
        inventory.setReserved(inventory.getReserved() + quantity);
        inventory.setUpdatedAt(OffsetDateTime.now());
    }

    private void releaseInventory(String productCode, int quantity) {
        SagaInventory inventory = inventory(productCode);
        inventory.setAvailable(inventory.getAvailable() + quantity);
        inventory.setReserved(inventory.getReserved() - quantity);
        inventory.setUpdatedAt(OffsetDateTime.now());
        meterRegistry.counter("jaywiki.saga.compensations", "step", "INVENTORY_RELEASED").increment();
    }

    private void commitInventory(String productCode, int quantity) {
        SagaInventory inventory = inventory(productCode);
        inventory.setReserved(inventory.getReserved() - quantity);
        inventory.setUpdatedAt(OffsetDateTime.now());
    }

    private void failOrder(SagaOrder order, SagaInstance saga, String failedStep) {
        order.setStatus("FAILED");
        order.setUpdatedAt(OffsetDateTime.now());
        saga.setStatus("FAILED");
        saga.setCurrentStep(failedStep);
        saga.setCompletedAt(OffsetDateTime.now());
        log(saga, "ORDER_FAILED", "SUCCESS", false, "Order marked failed");
    }

    private OrderSagaView finish(SagaInstance saga, OrderSagaFailAt failAt, String status) {
        outbox.record(saga.getId(), "ORDER_SAGA_FAILED", "{\"status\":\"FAILED\"}");
        meterRegistry.counter("jaywiki.saga.runs",
                "status", status, "fail_at", failAt.name()).increment();
        return view(saga);
    }

    /**
     * 이 프로세스 자신의 이름. 파드가 둘이라(HPA minReplicas 2) 같은 사가라도 어느 쪽이
     * 처리했는지가 매번 다르다. 화면이 그것을 그대로 보이게 하려고 단계마다 적어 둔다.
     */
    private static final String SELF = "spring@" + selfPod();

    private static String selfPod() {
        String host = System.getenv("HOSTNAME");
        return host == null || host.isBlank() ? "local" : host;
    }

    private void log(SagaInstance saga, String name, String status, boolean compensating, String message) {
        log(saga, name, status, compensating, message, SELF);
    }

    private void log(SagaInstance saga, String name, String status, boolean compensating,
                     String message, String actor) {
        SagaStep step = new SagaStep();
        step.setSagaId(saga.getId());
        step.setStepName(name);
        step.setStatus(status);
        step.setCompensating(compensating);
        step.setMessage(message);
        step.setCreatedAt(OffsetDateTime.now());
        step.setActor(actor == null ? SELF : actor);
        stepRepo.save(step);
    }

    private SagaInstance saga(String sagaId) {
        return sagaRepo.findById(sagaId)
                .orElseThrow(() -> new NotFoundException("saga not found: " + sagaId));
    }

    private SagaOrder order(String orderId) {
        return orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("order not found: " + orderId));
    }

    /** 구매자는 선택이다. 보냈는데 없는 id 면 조용히 넘기지 않고 404 를 낸다. */
    private String customerId(String requested) {
        if (requested == null || requested.isBlank()) return null;
        if (!customerRepo.existsById(requested)) {
            throw new NotFoundException("customer not found: " + requested);
        }
        return requested;
    }

    private SagaInventory inventory(String productCode) {
        return inventoryRepo.findById(productCode)
                .orElseThrow(() -> new NotFoundException("inventory not found: " + productCode));
    }

    private OrderSagaView view(SagaInstance saga) {
        SagaOrder order = order(saga.getOrderId());
        SagaInventory inventory = inventory(order.getProductCode());
        // 여기가 분리 지점이었다. 전에는 paymentRepo.findByOrderId 로 같은 트랜잭션·같은 DB 에서
        // 항상 최신을 읽었다. 이제는 payment-api 가 낸 이벤트로 만든 사본을 읽는다 —
        // 결제 서비스가 죽어도 화면은 뜨지만, 대신 최신이 아닐 수 있다.
        OrderSagaView.PaymentState paymentState = paymentProjectionRepo.findById(order.getId())
                .map(p -> new OrderSagaView.PaymentState(p.getStatus(), p.getObservedAt()))
                .orElseGet(() -> new OrderSagaView.PaymentState("NONE", null));
        // 배송도 같은 모양이다(5단계). 원본은 shipping-api 가 들고, 여기 있는 것은 사본이다.
        OrderSagaView.ShippingState shippingState = shippingProjectionRepo.findById(order.getId())
                .map(s -> new OrderSagaView.ShippingState(s.getStatus(), s.getObservedAt()))
                .orElseGet(() -> new OrderSagaView.ShippingState("NONE", null));
        List<SagaStepDto> steps = stepRepo.findBySagaIdOrderByIdAsc(saga.getId()).stream()
                .map(SagaStepDto::from)
                .toList();
        // 이름은 여기서 붙인다. 분리 뒤에도 결제·배송은 id 만 알아서 이 조립을 모놀리스가 계속 맡는다.
        OrderSagaView.CustomerState customer = Optional.ofNullable(order.getCustomerId())
                .flatMap(customerRepo::findById)
                .map(c -> new OrderSagaView.CustomerState(c.getId(), c.getName(), c.getGrade()))
                .orElse(null);
        return new OrderSagaView(
                saga.getId(),
                order.getId(),
                order.getStatus(),
                steps,
                customer,
                new OrderSagaView.OrderState(order.getStatus()),
                new OrderSagaView.InventoryState(inventory.getAvailable(), inventory.getReserved()),
                paymentState,
                shippingState);
    }

    /**
     * start() 의 결과. 재고 예약까지 성공했으면 sagaId·orderId 를 들고 다음 단계로 가고,
     * 실패 주입으로 그 자리에서 끝났으면 완성된 view 를 들고 즉시 반환한다.
     */
    public record Started(String sagaId, String orderId, OrderSagaView terminalView) {
        static Started running(String sagaId, String orderId) {
            return new Started(sagaId, orderId, null);
        }

        static Started terminal(OrderSagaView view) {
            return new Started(null, null, view);
        }

        public boolean finished() {
            return terminalView != null;
        }
    }
}
