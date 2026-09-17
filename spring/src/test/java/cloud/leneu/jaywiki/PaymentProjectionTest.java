package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.saga.PaymentEventConsumer;
import cloud.leneu.jaywiki.saga.PaymentProjection;
import cloud.leneu.jaywiki.saga.PaymentProjectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 프로젝션은 payment-api 가 낸 사실을 받아 만드는 읽기 전용 사본이다.
 *
 * Kafka 브로커 없이 컨슈머를 직접 부른다. 여기서 볼 것은 브로커가 아니라
 * "늦게 온 이벤트가 최신을 덮지 않는가" 같은 반영 규칙이다.
 */
@SpringBootTest(properties = {"app.opensearch.enabled=false", "app.kafka-demo.enabled=true"})
@Import(TestcontainersConfiguration.class)
class PaymentProjectionTest {

    @Autowired
    PaymentEventConsumer consumer;

    @Autowired
    PaymentProjectionRepository repo;

    @BeforeEach
    void clean() {
        repo.deleteAll();
    }

    @Test
    void 승인_이벤트를_받으면_사본이_생기고_받은_시각이_찍힌다() {
        consumer.onPaymentEvent(event("ord_p1", "pay_p1", "AUTHORIZED", "2026-08-17T10:00:00Z"));

        PaymentProjection saved = repo.findById("ord_p1").orElseThrow();
        assertThat(saved.getStatus()).isEqualTo("AUTHORIZED");
        assertThat(saved.getPaymentId()).isEqualTo("pay_p1");
        // observedAt 이 있어야 화면에 "n초 전 기준" 을 적을 수 있다.
        assertThat(saved.getObservedAt()).isNotNull();
    }

    @Test
    void 취소_이벤트가_승인을_덮는다() {
        consumer.onPaymentEvent(event("ord_p2", "pay_p2", "AUTHORIZED", "2026-08-17T10:00:00Z"));
        consumer.onPaymentEvent(event("ord_p2", "pay_p2", "CANCELLED", "2026-08-17T10:00:05Z"));

        // 취소가 반영 안 되면 화면이 취소된 결제를 AUTHORIZED 로 계속 보여준다.
        assertThat(repo.findById("ord_p2").orElseThrow().getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void 늦게_도착한_과거_이벤트는_최신을_덮지_않는다() {
        consumer.onPaymentEvent(event("ord_p3", "pay_p3", "CANCELLED", "2026-08-17T10:00:05Z"));
        consumer.onPaymentEvent(event("ord_p3", "pay_p3", "AUTHORIZED", "2026-08-17T10:00:00Z"));

        // 재시도가 섞이면 승인이 취소보다 뒤에 올 수 있다. occurredAt 이 그 판단의 근거다.
        assertThat(repo.findById("ord_p3").orElseThrow().getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void 필수_항목이_빠진_이벤트는_버린다() {
        consumer.onPaymentEvent("{\"orderId\":\"ord_p4\"}");

        assertThat(repo.findById("ord_p4")).isEmpty();
    }

    @Test
    void occurredAt_이_없으면_지금으로_두고_반영한다() {
        OffsetDateTime before = OffsetDateTime.now().minusSeconds(1);

        consumer.onPaymentEvent("""
                {"orderId":"ord_p5","paymentId":"pay_p5","status":"AUTHORIZED"}
                """);

        // 시각을 못 읽는다고 이벤트를 버리면 사본이 영영 안 생긴다. 버리는 것보다 낫다.
        PaymentProjection saved = repo.findById("ord_p5").orElseThrow();
        assertThat(saved.getOccurredAt()).isAfter(before);
    }

    private String event(String orderId, String paymentId, String status, String occurredAt) {
        return """
                {"orderId":"%s","paymentId":"%s","status":"%s","occurredAt":"%s","amountCents":49000}
                """.formatted(orderId, paymentId, status, occurredAt);
    }
}
