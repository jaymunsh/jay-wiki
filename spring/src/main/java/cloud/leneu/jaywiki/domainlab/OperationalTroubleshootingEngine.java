package cloud.leneu.jaywiki.domainlab;

import java.util.List;

final class OperationalTroubleshootingEngine {
    private OperationalTroubleshootingEngine() {
    }

    static DomainScenarioEngine.Result run(DomainScenarioType type, String mode, String runId) {
        return switch (type) {
            case COUPON_RACE -> coupon(mode, runId);
            case SETTLEMENT_BATCH -> settlement(mode, runId);
            case CONNECTION_POOL -> connectionPool(mode, runId);
            case N_PLUS_ONE -> nPlusOne(mode, runId);
            default -> throw new IllegalArgumentException("unsupported troubleshooting scenario: " + type.slug());
        };
    }

    private static DomainScenarioEngine.Result coupon(String mode, String runId) {
        String key = "coupon-" + runId;
        return switch (mode) {
            case "BASELINE" -> result("OVERSOLD", "조회와 차감 분리로 20건 초과 발급", 100, 120, key,
                    780, 0, 20, 1, 0,
                    step("STOCK_READ", "Coupon API", "WARNING", "동시 요청이 모두 잔여 수량 100을 읽었다."),
                    step("ISSUE_INSERTED", "PostgreSQL", "WARNING", "각 요청이 독립적으로 발급을 기록했다."),
                    step("LIMIT_EXCEEDED", "Coupon", "REJECTED", "한정 수량보다 20건 많이 발급됐다."));
            case "CONDITIONAL_UPDATE" -> result("BOUNDED", "조건부 UPDATE로 정확히 100건 발급", 100, 100, key,
                    210, 20, 0, 1, 0,
                    step("UPDATE_ATTEMPTED", "PostgreSQL", "SUCCESS", "remaining > 0 조건으로 수량을 갱신했다."),
                    step("AFFECTED_CHECKED", "Coupon API", "SUCCESS", "affected row 1인 요청만 발급했다."),
                    step("EXCESS_REJECTED", "Coupon API", "REJECTED", "초과 요청 20건을 품절 처리했다."));
            case "REDIS_LUA" -> result("ATOMIC", "Lua 원자 연산으로 발급 순서 보장", 100, 100, key,
                    95, 20, 0, 1, 0,
                    step("SCRIPT_EXECUTED", "Redis", "SUCCESS", "수량 확인과 차감을 한 Lua script에서 처리했다."),
                    step("ISSUE_ACCEPTED", "Coupon API", "SUCCESS", "허용된 100건을 발급 대기열에 기록했다."),
                    step("DB_RECONCILED", "PostgreSQL", "SUCCESS", "Redis 결과와 발급 원장을 대조했다."));
            case "DUPLICATE_REQUEST" -> result("IDEMPOTENT", "사용자별 중복 발급을 최초 결과로 제한", 120, 92, key,
                    120, 28, 0, 1, 0,
                    step("REQUEST_KEY_CHECKED", "Redis", "SUCCESS", "campaign·user key를 확인했다."),
                    step("DUPLICATES_REUSED", "Coupon API", "SUCCESS", "중복 28건은 최초 발급 결과를 반환했다."),
                    step("UNIQUE_RECORDED", "PostgreSQL", "SUCCESS", "고유 사용자 92명만 원장에 기록했다."));
            default -> throw unsupported(DomainScenarioType.COUPON_RACE, mode);
        };
    }

    private static DomainScenarioEngine.Result settlement(String mode, String runId) {
        String key = "settlement-" + runId;
        return switch (mode) {
            case "BASELINE_DUPLICATE" -> result("DUPLICATED", "재실행으로 정산 250건 중복", 10_000, 10_250, key,
                    3_800, 0, 250, 1, 0,
                    step("BATCH_STARTED", "Scheduler", "SUCCESS", "정산일 전체 대상을 처음부터 조회했다."),
                    step("PROCESS_CRASHED", "Settlement", "WARNING", "7,500건 처리 뒤 process가 종료됐다."),
                    step("FULL_RESTARTED", "Operator", "WARNING", "동일 날짜 배치를 전체 재실행했다."),
                    step("DUPLICATES_FOUND", "PostgreSQL", "REJECTED", "250건이 중복 정산됐다."));
            case "CHECKPOINT_RESUME" -> result("RESUMED", "마지막 checkpoint부터 처리 재개", 10_000, 10_000, key,
                    1_900, 0, 0, 1, 18,
                    step("CHECKPOINT_LOADED", "Settlement", "SUCCESS", "마지막 성공 cursor 7,500을 읽었다."),
                    step("REMAINDER_SELECTED", "PostgreSQL", "SUCCESS", "미처리 2,500건만 조회했다."),
                    step("BATCH_COMPLETED", "Settlement", "SUCCESS", "18초 뒤 전체 정산을 완료했다."));
            case "IDEMPOTENT_UPSERT" -> result("IDEMPOTENT", "거래·정산일 unique key로 중복 차단", 10_000, 10_000, key,
                    2_200, 250, 0, 1, 0,
                    step("FULL_RESTARTED", "Operator", "WARNING", "동일 정산일 작업을 재실행했다."),
                    step("UNIQUE_KEY_CHECKED", "PostgreSQL", "SUCCESS", "transaction·settlement_date key를 확인했다."),
                    step("DUPLICATES_SKIPPED", "Settlement", "SUCCESS", "이미 완료된 250건을 건너뛰었다."));
            case "PARTIAL_RETRY" -> result("RECOVERED", "실패 partition만 선택 재처리", 10_000, 10_000, key,
                    1_150, 0, 0, 2, 9,
                    step("FAILED_RANGE_FOUND", "Settlement", "SUCCESS", "실패 partition과 원인을 조회했다."),
                    step("RANGE_RETRIED", "Settlement", "SUCCESS", "해당 범위만 별도 worker로 처리했다."),
                    step("TOTAL_RECONCILED", "PostgreSQL", "SUCCESS", "합계와 건수를 원본 거래와 대조했다."));
            default -> throw unsupported(DomainScenarioType.SETTLEMENT_BATCH, mode);
        };
    }

    private static DomainScenarioEngine.Result connectionPool(String mode, String runId) {
        String key = "pool-" + runId;
        return switch (mode) {
            case "TX_EXTERNAL_CALL" -> result("EXHAUSTED", "외부 호출 동안 DB connection 20개 점유", 20, 20, key,
                    4_800, 75, 16, 1, 12,
                    step("TRANSACTION_OPENED", "Spring", "SUCCESS", "DB transaction과 connection을 확보했다."),
                    step("PARTNER_WAITED", "HTTP client", "WARNING", "transaction 안에서 외부 API를 기다렸다."),
                    step("POOL_EXHAUSTED", "HikariCP", "REJECTED", "active 20, pending 16으로 신규 요청이 대기했다."));
            case "BOUNDARY_SPLIT" -> result("STABLE", "외부 호출과 DB transaction 경계 분리", 20, 7, key,
                    240, 0, 0, 1, 0,
                    step("PARTNER_CALLED", "HTTP client", "SUCCESS", "DB connection 없이 외부 상태를 확인했다."),
                    step("TRANSACTION_OPENED", "Spring", "SUCCESS", "결과 반영 구간에서만 transaction을 열었다."),
                    step("POOL_RELEASED", "HikariCP", "SUCCESS", "최대 active connection을 7개로 제한했다."));
            case "TIMEOUT" -> result("BOUNDED", "connection·read timeout으로 점유 시간 제한", 20, 10, key,
                    720, 8, 0, 1, 2,
                    step("DEADLINE_APPLIED", "HTTP client", "SUCCESS", "connect와 read timeout을 분리했다."),
                    step("SLOW_CALL_ABORTED", "HTTP client", "REJECTED", "느린 호출 8건을 제한 시간에 종료했다."),
                    step("CONNECTION_RELEASED", "HikariCP", "SUCCESS", "transaction 자원을 즉시 반환했다."));
            case "BULKHEAD" -> result("ISOLATED", "외부 연동 동시성을 별도 bulkhead로 격리", 20, 8, key,
                    310, 12, 0, 1, 0,
                    step("SLOTS_CHECKED", "Bulkhead", "SUCCESS", "제휴 호출 동시성 8개를 적용했다."),
                    step("EXCESS_FAILED_FAST", "Spring", "REJECTED", "초과 요청 12건을 빠르게 거절했다."),
                    step("DB_POOL_PROTECTED", "HikariCP", "SUCCESS", "일반 DB 요청의 connection을 보존했다."));
            default -> throw unsupported(DomainScenarioType.CONNECTION_POOL, mode);
        };
    }

    private static DomainScenarioEngine.Result nPlusOne(String mode, String runId) {
        String key = "query-" + runId;
        return switch (mode) {
            case "N_PLUS_ONE" -> result("INEFFICIENT", "주문 100건 조회에 SQL 301회 실행", 100, 301, key,
                    1_280, 0, 0, 1, 0,
                    step("ORDERS_SELECTED", "JPA", "SUCCESS", "주문 목록을 SQL 1회로 조회했다."),
                    step("ITEMS_LAZY_LOADED", "JPA", "WARNING", "주문별 상품을 100회 추가 조회했다."),
                    step("PAYMENTS_LAZY_LOADED", "JPA", "WARNING", "결제와 배송을 200회 추가 조회했다."));
            case "FETCH_JOIN" -> result("OPTIMIZED", "to-one fetch join으로 SQL 2회", 100, 2, key,
                    145, 0, 0, 1, 0,
                    step("ORDERS_FETCHED", "JPA", "SUCCESS", "주문과 to-one 연관을 fetch join했다."),
                    step("COLLECTION_FETCHED", "JPA", "SUCCESS", "컬렉션은 별도 batch query로 조회했다."),
                    step("RESULT_MAPPED", "Order API", "SUCCESS", "중복 row를 제거해 응답을 만들었다."));
            case "PROJECTION" -> result("LEAN", "목록 전용 projection으로 SQL 1회", 100, 1, key,
                    82, 0, 0, 1, 0,
                    step("COLUMNS_SELECTED", "Query", "SUCCESS", "화면에 필요한 컬럼만 선택했다."),
                    step("DTO_MAPPED", "Order API", "SUCCESS", "entity graph 없이 목록 DTO를 구성했다."),
                    step("PAYLOAD_REDUCED", "HTTP", "SUCCESS", "응답 크기와 영속성 비용을 줄였다."));
            case "BATCH_FETCH" -> result("BOUNDED", "batch fetch로 SQL 8회", 100, 8, key,
                    190, 0, 0, 1, 0,
                    step("ORDERS_SELECTED", "JPA", "SUCCESS", "주문 100건을 조회했다."),
                    step("ASSOCIATIONS_BATCHED", "JPA", "SUCCESS", "연관 ID를 묶어 batch query를 실행했다."),
                    step("QUERY_COUNT_CHECKED", "Test", "SUCCESS", "SQL 횟수가 데이터 건수에 비례하지 않음을 확인했다."));
            default -> throw unsupported(DomainScenarioType.N_PLUS_ONE, mode);
        };
    }

    private static DomainScenarioEngine.Result result(String status, String headline, int before, int after,
                                                       String key, int p95Ms, int rejected, int lag,
                                                       int replicas, int recoverySeconds,
                                                       DomainScenarioEngine.Step... steps) {
        return new DomainScenarioEngine.Result(status, headline, before, after, key, p95Ms, rejected,
                lag, replicas, recoverySeconds, List.of(steps));
    }

    private static DomainScenarioEngine.Step step(String action, String actor, String status, String detail) {
        return new DomainScenarioEngine.Step(action, actor, status, detail);
    }

    private static IllegalArgumentException unsupported(DomainScenarioType type, String mode) {
        return new IllegalArgumentException("unsupported mode for " + type.slug() + ": " + mode);
    }
}
