package cloud.leneu.jaywiki.saga;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Saga 오케스트레이터. 순서를 지시할 뿐 DB 트랜잭션을 열지 않는다.
 *
 * 이 클래스에 @Transactional 이 하나도 없는 것이 핵심이다. DB 작업은 전부 OrderSagaSteps 의
 * 짧은 트랜잭션 안에서 끝나고, 결제·배송 서비스 호출은 그 사이 — 즉 트랜잭션 밖 — 에서 일어난다.
 * 그래야 외부 응답을 기다리는 동안 DB connection 을 쥐고 있지 않는다.
 *
 * 대가로 원자성을 잃는다. 그래서 실패를 두 종류로 나눠 받는다 — 참여자가 거절한 것(접수 안 됨)과
 * 참여자에 못 닿은 것(접수됐는지 모름)이다. 앞은 보상으로 되돌리고, 뒤는 모르는 것에 손대지 않고
 * 모놀리스가 소유한 재고만 되돌린 뒤 503 을 올린다.
 *
 * 남은 한계는 둘이다. 참여자 쪽에 남았을지 모르는 원본을 나중에 맞추는 절차가 없고,
 * 이 프로세스 자체가 호출 도중 죽으면 아무도 이어받지 못한 saga 가 STARTED 로 남는다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderSagaService {
    private final OrderSagaSteps steps;
    private final PaymentClient paymentClient;
    private final ShippingClient shippingClient;

    public OrderSagaView run(OrderSagaRequest request) {
        Optional<OrderSagaView> replayed = steps.findByIdempotencyKey(request.idempotencyKey());
        if (replayed.isPresent()) {
            return replayed.get();
        }

        OrderSagaSteps.Started started = steps.start(request);
        if (started.finished()) {
            return started.terminalView();
        }

        PaymentClient.PaymentAuthorizeResponse payment;
        try {
            // 트랜잭션 밖에서 부른다. 여기가 이 설계의 이유다.
            payment = paymentClient.authorize(new PaymentClient.PaymentAuthorizeRequest(
                    started.orderId(),
                    OrderSagaSteps.UNIT_AMOUNT_CENTS * request.quantity(),
                    request.idempotencyKey(),
                    request.failAt() == OrderSagaFailAt.PAYMENT_AUTHORIZE));
        } catch (PaymentAuthorizationFailedException e) {
            return steps.compensateAfterPaymentFailure(started, request, e.servedBy());
        } catch (PaymentServiceUnavailableException e) {
            // 결제가 접수됐는지 모른다. 그래도 이 주문이 완료되지 않은 것은 확실하니
            // 재고는 되돌린다. 503 은 그대로 올려 보낸다 — 호출자는 실패를 알아야 한다.
            steps.compensateAfterParticipantUnavailable(started, request, "PAYMENT_AUTHORIZED");
            throw e;
        }
        steps.recordPaymentAuthorized(started, payment.servedBy());

        ShippingClient.ShipmentResponse shipment;
        try {
            // 배송도 트랜잭션 밖의 원격 호출이 됐다(5단계). 전에는 여기가 로컬 row 하나였다.
            shipment = shippingClient.request(new ShippingClient.ShipmentRequest(
                    started.orderId(),
                    request.idempotencyKey(),
                    request.failAt() == OrderSagaFailAt.SHIPPING_REQUEST));
        } catch (ShippingRequestFailedException e) {
            // 보상도 외부 호출이 먼저고 기록이 나중이다.
            PaymentClient.PaymentCancelResponse cancelled = paymentClient.cancel(payment.paymentId());
            return steps.compensateAfterShippingFailure(started, request,
                    e.servedBy(), cancelled == null ? null : cancelled.servedBy());
        } catch (ShippingServiceUnavailableException e) {
            // 배송이 접수됐는지는 모르지만 결제가 잡힌 것은 확실하다. 그것부터 되돌린다.
            cancelPaymentQuietly(payment.paymentId());
            steps.compensateAfterParticipantUnavailable(started, request, "SHIPPING_REQUESTED");
            throw e;
        }

        return steps.confirm(started, request, shipment == null ? null : shipment.servedBy());
    }

    /**
     * 보상 중의 결제 취소는 실패해도 보상을 멈추지 않는다.
     *
     * <p>여기서 예외를 그대로 올리면 재고 해제까지 같이 날아간다 — 되돌릴 수 있는 것마저
     * 안 되돌리는 셈이다. 결제에 못 닿으면 그 건은 미결로 남고, 재고는 아래에서 풀린다.
     */
    private void cancelPaymentQuietly(String paymentId) {
        try {
            paymentClient.cancel(paymentId);
        } catch (PaymentServiceUnavailableException e) {
            log.warn("보상 중 결제 취소에 실패했다. 결제 {} 는 미결로 남는다", paymentId, e);
        }
    }

    public OrderSagaView get(String sagaId) {
        return steps.get(sagaId);
    }

    public List<OrderSagaView> recent(int size) {
        return steps.recent(size);
    }

    public List<OrderSagaView.CustomerState> customers() {
        return steps.customers();
    }
}
