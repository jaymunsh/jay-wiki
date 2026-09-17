package cloud.leneu.jaywiki.domainlab;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DomainScenarioEngine {

    public Result run(DomainScenarioType type, String mode, String runId) {
        return switch (type) {
            case GIFT_CARD -> giftCard(mode, runId);
            // PARTNER_API 는 DomainScenarioController 에서 PartnerApiRehearsalService 로 간다.
            // 실제 HTTP 호출과 실측값을 쓰므로 정의된 흐름을 돌려주면 안 된다.
            case PARTNER_API -> throw new IllegalStateException(
                    "partner-api is executed by PartnerApiRehearsalService, not by this engine");
            case ORDER -> order(mode, runId);
            case TRAFFIC_BURST -> trafficBurst(mode, runId);
            case COUPON_RACE, SETTLEMENT_BATCH, CONNECTION_POOL, N_PLUS_ONE ->
                    OperationalTroubleshootingEngine.run(type, mode, runId);
            case DATA_CORRECTION, PRIVACY_LIFECYCLE, SPREADSHEET_OPERATIONS, BUSINESS_METRICS,
                    NOTIFICATION_DELIVERY, MAINTENANCE_MODE, IMAGE_UPLOAD_PIPELINE -> OperationsPracticeEngine.run(type, mode, runId);
        };
    }

    private Result giftCard(String mode, String runId) {
        String key = "gc-" + runId;
        return switch (mode) {
            case "NORMAL" -> result("COMPLETED", "상품권 10,000원 사용 완료", 50_000, 40_000, key,
                    step("ISSUED", "Gift card", "SUCCESS", "50,000원 상품권을 활성화했다."),
                    step("USE_REQUESTED", "Commerce API", "SUCCESS", "10,000원 사용 요청을 받았다."),
                    step("BALANCE_DEBITED", "Ledger", "SUCCESS", "원장에 -10,000원을 기록하고 잔액을 확정했다."));
            case "DUPLICATE_RETRY" -> result("IDEMPOTENT", "동일 요청은 기존 결과를 반환", 50_000, 40_000, key,
                    step("ISSUED", "Gift card", "SUCCESS", "50,000원 상품권을 활성화했다."),
                    step("USE_REQUESTED", "Commerce API", "SUCCESS", "첫 사용 요청을 접수했다."),
                    step("BALANCE_DEBITED", "Ledger", "SUCCESS", "idempotency key와 -10,000원 원장을 함께 기록했다."),
                    step("RETRY_RECEIVED", "Client", "WARNING", "응답 유실로 같은 key를 다시 전송했다."),
                    step("DUPLICATE_RETURNED", "Commerce API", "SUCCESS", "추가 차감 없이 첫 결과를 반환했다."));
            case "CONCURRENT_USE" -> result("ONE_ACCEPTED", "마지막 유효 잔액은 한 요청만 사용", 10_000, 0, key,
                    step("TWO_REQUESTS", "Clients", "WARNING", "10,000원 사용 요청 두 건이 동시에 도착했다."),
                    step("BALANCE_LOCKED", "PostgreSQL", "SUCCESS", "잔액 갱신 경계를 한 transaction으로 직렬화했다."),
                    step("FIRST_DEBITED", "Ledger", "SUCCESS", "첫 요청의 -10,000원 원장을 확정했다."),
                    step("SECOND_REJECTED", "Commerce API", "REJECTED", "두 번째 요청은 잔액 부족으로 거절했다."));
            case "TIMEOUT_RETRY" -> result("RECONCILED", "응답 유실 뒤 조회로 사용 결과 복구", 50_000, 40_000, key,
                    step("USE_REQUESTED", "Client", "SUCCESS", "10,000원 사용 요청을 보냈다."),
                    step("BALANCE_DEBITED", "Ledger", "SUCCESS", "서버 transaction은 정상 commit됐다."),
                    step("RESPONSE_LOST", "Network", "WARNING", "응답이 클라이언트에 도착하지 않았다."),
                    step("RETRY_RECEIVED", "Commerce API", "WARNING", "같은 idempotency key로 재시도했다."),
                    step("RESULT_RECOVERED", "Commerce API", "SUCCESS", "기존 원장을 조회해 완료 결과를 복구했다."));
            case "CANCEL" -> result("CANCELLED", "사용 취소 후 잔액 복구", 40_000, 50_000, key,
                    step("USE_FOUND", "Ledger", "SUCCESS", "취소 대상 사용 원장을 찾았다."),
                    step("CANCEL_RECORDED", "Ledger", "SUCCESS", "+10,000원 취소 원장을 새로 기록했다."),
                    step("BALANCE_RESTORED", "Gift card", "SUCCESS", "잔액을 50,000원으로 복구했다."));
            default -> throw unsupported(DomainScenarioType.GIFT_CARD, mode);
        };
    }

    private Result order(String mode, String runId) {
        String key = "order-" + runId;
        return switch (mode) {
            case "NORMAL" -> result("CONFIRMED", "주문·재고·결제 확정", 1, 0, key,
                    step("ORDER_CREATED", "Order", "SUCCESS", "가격 snapshot과 주문을 만들었다."),
                    step("STOCK_RESERVED", "Inventory", "SUCCESS", "마지막 재고 한 개를 예약했다."),
                    step("PAYMENT_AUTHORIZED", "Payment", "SUCCESS", "결제를 승인했다."),
                    step("ORDER_CONFIRMED", "Order", "SUCCESS", "주문을 확정하고 예약 재고를 판매로 전환했다."));
            case "LAST_STOCK_RACE" -> result("ONE_CONFIRMED", "마지막 재고는 한 주문만 확보", 1, 0, key,
                    step("TWO_ORDERS_CREATED", "Order", "WARNING", "마지막 재고에 주문 두 건이 도착했다."),
                    step("STOCK_LOCKED", "PostgreSQL", "SUCCESS", "재고 갱신 경계를 직렬화했다."),
                    step("FIRST_RESERVED", "Inventory", "SUCCESS", "첫 주문이 재고를 예약했다."),
                    step("SECOND_REJECTED", "Inventory", "REJECTED", "두 번째 주문은 품절로 종료했다."));
            case "DUPLICATE_CALLBACK" -> result("IDEMPOTENT", "중복 결제 callback을 한 번만 반영", 1, 0, key,
                    step("STOCK_RESERVED", "Inventory", "SUCCESS", "재고를 예약했다."),
                    step("CALLBACK_RECEIVED", "Payment", "SUCCESS", "첫 결제 성공 callback을 반영했다."),
                    step("ORDER_CONFIRMED", "Order", "SUCCESS", "주문을 한 번 확정했다."),
                    step("CALLBACK_DUPLICATED", "Payment", "WARNING", "같은 payment ID의 callback이 다시 도착했다."),
                    step("DUPLICATE_IGNORED", "Order", "SUCCESS", "상태와 재고를 추가 변경하지 않았다."));
            case "CONFIRM_FAILURE" -> result("COMPENSATED", "확정 실패 후 결제·재고 보상", 1, 1, key,
                    step("ORDER_CREATED", "Order", "SUCCESS", "주문을 만들었다."),
                    step("STOCK_RESERVED", "Inventory", "SUCCESS", "재고를 예약했다."),
                    step("PAYMENT_AUTHORIZED", "Payment", "SUCCESS", "결제를 승인했다."),
                    step("CONFIRM_FAILED", "Order", "REJECTED", "주문 확정 transaction이 실패했다."),
                    step("PAYMENT_CANCELLED", "Payment", "SUCCESS", "승인 결제를 취소했다."),
                    step("STOCK_RELEASED", "Inventory", "SUCCESS", "예약 재고를 복원했다."));
            case "RESERVATION_EXPIRED" -> result("EXPIRED", "예약 만료로 재고 자동 복구", 1, 1, key,
                    step("ORDER_CREATED", "Order", "SUCCESS", "주문과 10분 예약 만료시각을 만들었다."),
                    step("STOCK_RESERVED", "Inventory", "SUCCESS", "재고를 임시 예약했다."),
                    step("PAYMENT_NOT_RECEIVED", "Payment", "WARNING", "만료시각까지 승인 callback이 없었다."),
                    step("RESERVATION_EXPIRED", "Scheduler", "SUCCESS", "만료 주문을 찾아 취소했다."),
                    step("STOCK_RELEASED", "Inventory", "SUCCESS", "예약 재고를 판매 가능 상태로 복구했다."));
            default -> throw unsupported(DomainScenarioType.ORDER, mode);
        };
    }

    private Result trafficBurst(String mode, String runId) {
        String key = "traffic-" + runId;
        return switch (mode) {
            case "BASELINE" -> trafficResult("SATURATED", "직접 처리 경로가 포화", 600, 220, key,
                    1_450, 0, 380, 1, 95,
                    step("BURST_STARTED", "Load model", "WARNING", "600 RPS 고정 입력을 시작했다."),
                    step("DB_DIRECT_WRITE", "Spring API", "WARNING", "모든 요청이 동기 DB 처리 경로로 진입했다."),
                    step("POOL_SATURATED", "PostgreSQL", "REJECTED", "connection 대기와 p95가 함께 증가했다."),
                    step("BACKLOG_REMAINED", "Recovery", "WARNING", "입력 종료 뒤 95초 동안 backlog가 남았다."));
            case "RATE_LIMIT" -> trafficResult("SHED", "초과 요청을 빠르게 제한", 600, 220, key,
                    180, 380, 0, 1, 0,
                    step("BURST_STARTED", "Load model", "WARNING", "600 RPS 고정 입력을 시작했다."),
                    step("TOKEN_CHECKED", "Redis", "SUCCESS", "허용 가능한 요청 예산을 확인했다."),
                    step("EXCESS_REJECTED", "BFF", "REJECTED", "380건을 429로 빠르게 종료했다."),
                    step("CAPACITY_PROTECTED", "Spring API", "SUCCESS", "처리 경로를 220 RPS로 보호했다."));
            case "QUEUE_BUFFER" -> trafficResult("BUFFERED", "Kafka가 순간 입력을 버퍼링", 600, 240, key,
                    210, 0, 360, 1, 90,
                    step("BURST_STARTED", "Load model", "WARNING", "600 RPS 주문 접수를 시작했다."),
                    step("EVENT_BUFFERED", "Kafka", "SUCCESS", "접수 이벤트를 topic에 기록했다."),
                    step("CONSUMER_DRAINING", "Order consumer", "WARNING", "240 RPS로 처리하며 lag 360이 생겼다."),
                    step("BACKLOG_DRAINED", "Kafka", "SUCCESS", "입력 종료 90초 뒤 backlog를 해소했다."));
            case "SLOW_CONSUMER" -> trafficResult("LAGGING", "느린 Consumer에서 lag 누적", 600, 120, key,
                    260, 0, 480, 1, 240,
                    step("EVENT_BUFFERED", "Kafka", "SUCCESS", "입력 이벤트는 유실 없이 저장됐다."),
                    step("DEPENDENCY_SLOWED", "Notification", "WARNING", "외부 의존성 응답이 느려졌다."),
                    step("CONSUMER_LAGGED", "Order consumer", "WARNING", "처리량이 120 RPS로 내려갔다."),
                    step("RECOVERY_DELAYED", "Recovery", "REJECTED", "backlog 해소에 240초가 필요했다."));
            case "DUPLICATE_BURST" -> trafficResult("DEDUPED", "중복 주문을 처리 경계 앞에서 차단", 600, 180, key,
                    150, 420, 0, 1, 0,
                    step("DUPLICATES_SENT", "Clients", "WARNING", "동일한 구매 key가 반복 전송됐다."),
                    step("KEY_CHECKED", "Redis", "SUCCESS", "사용자·상품·요청 key를 조회했다."),
                    step("DUPLICATES_REUSED", "Order API", "SUCCESS", "420건은 최초 결과를 재사용했다."),
                    step("UNIQUE_PROCESSED", "PostgreSQL", "SUCCESS", "고유 요청 180건만 처리했다."));
            case "RECOVERY" -> trafficResult("RECOVERED", "확장 뒤 backlog를 제한 시간 안에 해소", 0, 360, key,
                    95, 0, 0, 2, 45,
                    step("INPUT_STOPPED", "Load model", "SUCCESS", "추가 입력을 중단했다."),
                    step("REPLICA_SCALED", "HPA", "SUCCESS", "Consumer replica를 1개에서 2개로 늘렸다."),
                    step("LAG_DRAINED", "Kafka", "SUCCESS", "360 RPS로 backlog를 처리했다."),
                    step("STEADY_STATE", "HPA", "SUCCESS", "45초 뒤 lag 0과 정상 지연시간을 확인했다."));
            default -> throw unsupported(DomainScenarioType.TRAFFIC_BURST, mode);
        };
    }

    private Result result(String status, String headline, int before, int after, String key, Step... steps) {
        return new Result(status, headline, before, after, key, 0, 0, 0, 0, 0, List.of(steps));
    }

    private Result trafficResult(String status, String headline, int incomingRps, int processedRps, String key,
                                 int p95Ms, int rejectedCount, int queueLag, int replicas, int recoverySeconds,
                                 Step... steps) {
        return new Result(status, headline, incomingRps, processedRps, key, p95Ms, rejectedCount,
                queueLag, replicas, recoverySeconds, List.of(steps));
    }

    private Step step(String action, String actor, String status, String detail) {
        return new Step(action, actor, status, detail);
    }

    private IllegalArgumentException unsupported(DomainScenarioType type, String mode) {
        return new IllegalArgumentException("unsupported mode for " + type.slug() + ": " + mode);
    }

    public record Result(String status, String headline, int beforeAmount, int afterAmount,
                         String idempotencyKey, int p95Ms, int rejectedCount, int queueLag,
                         int replicas, int recoverySeconds, List<Step> steps) {
    }

    public record Step(String action, String actor, String status, String detail) {
    }
}
