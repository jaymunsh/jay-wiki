package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.domainlab.DomainScenarioEngine;
import cloud.leneu.jaywiki.domainlab.DomainScenarioType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DomainScenarioEngineTest {

    private final DomainScenarioEngine engine = new DomainScenarioEngine();

    @Test
    void 상품권_중복요청은_한번만_차감하고_원장에_중복처리를_남긴다() {
        var result = engine.run(DomainScenarioType.GIFT_CARD, "DUPLICATE_RETRY", "run-gift");

        assertThat(result.status()).isEqualTo("IDEMPOTENT");
        assertThat(result.beforeAmount()).isEqualTo(50_000);
        assertThat(result.afterAmount()).isEqualTo(40_000);
        assertThat(result.steps()).extracting(step -> step.action())
                .containsExactly("ISSUED", "USE_REQUESTED", "BALANCE_DEBITED", "RETRY_RECEIVED", "DUPLICATE_RETURNED");
    }

    /**
     * partner-api 는 PartnerApiRehearsalService 가 실제 HTTP 로 실행하고 실측값을 남긴다.
     * 엔진이 정의된 흐름을 돌려주면 화면이 실측인 척하게 되므로, 아예 못 하도록 막아 두고
     * 그 결정을 테스트로 고정한다.
     */
    @Test
    void 엔진은_partner_api를_직접_실행하지_않는다() {
        assertThatThrownBy(() -> engine.run(DomainScenarioType.PARTNER_API, "TIMEOUT_CALLBACK", "run-api"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PartnerApiRehearsalService");
    }

    @Test
    void 주문확정_실패는_결제를_취소하고_예약재고를_복원한다() {
        var result = engine.run(DomainScenarioType.ORDER, "CONFIRM_FAILURE", "run-order");

        assertThat(result.status()).isEqualTo("COMPENSATED");
        assertThat(result.beforeAmount()).isEqualTo(1);
        assertThat(result.afterAmount()).isEqualTo(1);
        assertThat(result.steps()).extracting(step -> step.action())
                .containsExactly("ORDER_CREATED", "STOCK_RESERVED", "PAYMENT_AUTHORIZED", "CONFIRM_FAILED", "PAYMENT_CANCELLED", "STOCK_RELEASED");
    }

    @Test
    void 트래픽_버퍼링은_입력과_처리량_차이를_lag와_복구시간으로_남긴다() {
        var result = engine.run(DomainScenarioType.TRAFFIC_BURST, "QUEUE_BUFFER", "run-traffic");

        assertThat(result.status()).isEqualTo("BUFFERED");
        assertThat(result.beforeAmount()).isEqualTo(600);
        assertThat(result.afterAmount()).isEqualTo(240);
        assertThat(result.queueLag()).isEqualTo(360);
        assertThat(result.recoverySeconds()).isEqualTo(90);
        assertThat(result.steps()).extracting(step -> step.action())
                .containsExactly("BURST_STARTED", "EVENT_BUFFERED", "CONSUMER_DRAINING", "BACKLOG_DRAINED");
    }

    @Test
    void 쿠폰_조건부갱신은_한정수량을_넘기지_않는다() {
        var result = engine.run(DomainScenarioType.COUPON_RACE, "CONDITIONAL_UPDATE", "run-coupon");
        assertThat(result.status()).isEqualTo("BOUNDED");
        assertThat(result.afterAmount()).isEqualTo(100);
        assertThat(result.rejectedCount()).isEqualTo(20);
    }

    @Test
    void 정산_checkpoint는_남은범위부터_재개한다() {
        var result = engine.run(DomainScenarioType.SETTLEMENT_BATCH, "CHECKPOINT_RESUME", "run-settlement");
        assertThat(result.status()).isEqualTo("RESUMED");
        assertThat(result.afterAmount()).isEqualTo(10_000);
        assertThat(result.recoverySeconds()).isEqualTo(18);
    }

    @Test
    void transaction_경계분리는_connection_점유를_줄인다() {
        var result = engine.run(DomainScenarioType.CONNECTION_POOL, "BOUNDARY_SPLIT", "run-pool");
        assertThat(result.status()).isEqualTo("STABLE");
        assertThat(result.beforeAmount()).isEqualTo(20);
        assertThat(result.afterAmount()).isEqualTo(7);
    }

    @Test
    void projection은_주문목록_SQL을_한번으로_제한한다() {
        var result = engine.run(DomainScenarioType.N_PLUS_ONE, "PROJECTION", "run-query");
        assertThat(result.status()).isEqualTo("LEAN");
        assertThat(result.beforeAmount()).isEqualTo(100);
        assertThat(result.afterAmount()).isEqualTo(1);
    }

    @Test
    void 운영데이터_조건부정정은_한건만_바꾸고_불변조건을_검증한다() {
        var result = engine.run(DomainScenarioType.DATA_CORRECTION, "CONDITIONAL_UPDATE", "run-correction");
        assertThat(result.status()).isEqualTo("VERIFIED");
        assertThat(result.afterAmount()).isEqualTo(1);
        assertThat(result.steps()).extracting(step -> step.action()).contains("CONDITIONAL_UPDATED", "INVARIANTS_VERIFIED");
    }

    @Test
    void 개인정보_만료파기는_백업복원_재노출까지_검사한다() {
        var result = engine.run(DomainScenarioType.PRIVACY_LIFECYCLE, "PURGE_WITH_RETENTION", "run-privacy");
        assertThat(result.status()).isEqualTo("PURGED");
        assertThat(result.afterAmount()).isZero();
        assertThat(result.steps()).extracting(step -> step.action()).contains("RESTORE_TESTED");
    }

    @Test
    void streaming_export는_peak_memory를_제한한다() {
        var result = engine.run(DomainScenarioType.SPREADSHEET_OPERATIONS, "STREAMING_EXPORT", "run-sheet");
        assertThat(result.status()).isEqualTo("BOUNDED");
        assertThat(result.beforeAmount()).isEqualTo(820);
        assertThat(result.afterAmount()).isEqualTo(96);
    }

    @Test
    void 지표계약은_기준값과_화면결과를_일치시킨다() {
        var result = engine.run(DomainScenarioType.BUSINESS_METRICS, "DEFINED_METRIC", "run-metrics");
        assertThat(result.status()).isEqualTo("CONSISTENT");
        assertThat(result.beforeAmount()).isEqualTo(result.afterAmount());
    }

    @Test
    void 알림_timeout은_상태조회로_중복발송을_막는다() {
        var result = engine.run(DomainScenarioType.NOTIFICATION_DELIVERY, "TIMEOUT_RETRY", "run-message");
        assertThat(result.status()).isEqualTo("RECONCILED");
        assertThat(result.steps()).extracting(step -> step.action()).contains("STATUS_QUERIED", "DELIVERY_REUSED");
    }

    @Test
    void 점검복구는_smoke와_backlog_확인뒤_기능을_연다() {
        var result = engine.run(DomainScenarioType.MAINTENANCE_MODE, "RECOVERY", "run-maintenance");
        assertThat(result.status()).isEqualTo("RECOVERED");
        assertThat(result.afterAmount()).isEqualTo(8);
        assertThat(result.steps()).extracting(step -> step.action()).contains("SMOKE_PASSED", "BACKLOG_CHECKED");
    }

    @Test
    void 이미지_용량초과는_MinIO_저장전에_차단한다() {
        var result = engine.run(DomainScenarioType.IMAGE_UPLOAD_PIPELINE, "REJECT_OVERSIZE", "run-image");
        assertThat(result.status()).isEqualTo("REJECTED");
        assertThat(result.beforeAmount()).isEqualTo(12_288);
        assertThat(result.afterAmount()).isZero();
        assertThat(result.steps()).extracting(step -> step.action())
                .containsExactly("LENGTH_CHECKED", "MAGIC_BYTES_CHECKED", "PIXELS_CHECKED", "UPLOAD_REJECTED");
    }
}
