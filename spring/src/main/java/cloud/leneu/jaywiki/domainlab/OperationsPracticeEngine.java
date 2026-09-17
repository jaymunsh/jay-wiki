package cloud.leneu.jaywiki.domainlab;

import java.util.List;

final class OperationsPracticeEngine {
    private OperationsPracticeEngine() {
    }

    static DomainScenarioEngine.Result run(DomainScenarioType type, String mode, String runId) {
        return switch (type) {
            case DATA_CORRECTION -> dataCorrection(mode, runId);
            case PRIVACY_LIFECYCLE -> privacyLifecycle(mode, runId);
            case SPREADSHEET_OPERATIONS -> spreadsheetOperations(mode, runId);
            case BUSINESS_METRICS -> businessMetrics(mode, runId);
            case NOTIFICATION_DELIVERY -> notificationDelivery(mode, runId);
            case MAINTENANCE_MODE -> maintenanceMode(mode, runId);
            case IMAGE_UPLOAD_PIPELINE -> imageUploadPipeline(mode, runId);
            default -> throw new IllegalArgumentException("unsupported operations practice: " + type.slug());
        };
    }

    private static DomainScenarioEngine.Result dataCorrection(String mode, String runId) {
        String key = "correction-" + runId;
        return switch (mode) {
            case "DIRECT_UPDATE" -> result("UNSAFE", "범위 없는 UPDATE가 37건을 변경", 1, 37, key,
                    step("TICKET_RECEIVED", "CS", "SUCCESS", "누락 포인트 한 건의 복구 요청을 접수했다."),
                    step("UPDATE_EXECUTED", "Operator", "WARNING", "대상 snapshot과 expected state 없이 UPDATE를 실행했다."),
                    step("SCOPE_EXCEEDED", "PostgreSQL", "REJECTED", "예상 1건보다 많은 37건이 변경됐다."));
            case "SELECT_ONLY" -> result("DRY_RUN", "수정 전 대상과 영향 범위를 확인", 1, 1, key,
                    step("EVIDENCE_MATCHED", "Operator", "SUCCESS", "CS ticket과 거래 원장을 대조했다."),
                    step("TARGET_SELECTED", "PostgreSQL", "SUCCESS", "고객·거래·현재 상태 조건으로 대상 1건을 조회했다."),
                    step("SNAPSHOT_SAVED", "Audit", "SUCCESS", "수정 전 값과 rollback key를 보존했다."));
            case "CONDITIONAL_UPDATE" -> result("VERIFIED", "조건부 수정 1건과 불변조건 검증 완료", 1, 1, key,
                    step("TARGET_SELECTED", "PostgreSQL", "SUCCESS", "예상 상태인 대상 1건을 확정했다."),
                    step("APPROVAL_LINKED", "Audit", "SUCCESS", "ticket과 승인자를 작업 식별자에 연결했다."),
                    step("CONDITIONAL_UPDATED", "PostgreSQL", "SUCCESS", "expected state 조건과 affected rows 1을 확인했다."),
                    step("INVARIANTS_VERIFIED", "Ledger", "SUCCESS", "잔액과 원장 합계가 일치함을 재조회했다."));
            case "ROLLBACK" -> result("ROLLED_BACK", "보존된 snapshot으로 원상 복구", 1, 1, key,
                    step("AUDIT_LOADED", "Operator", "SUCCESS", "원 작업과 before snapshot을 조회했다."),
                    step("CURRENT_STATE_CHECKED", "PostgreSQL", "SUCCESS", "후속 변경이 없는지 확인했다."),
                    step("ROLLBACK_APPLIED", "PostgreSQL", "WARNING", "조건부 역변경을 실행했다."),
                    step("RESTORE_VERIFIED", "Audit", "SUCCESS", "복구 값과 작업 이력을 검증했다."));
            default -> throw unsupported(DomainScenarioType.DATA_CORRECTION, mode);
        };
    }

    private static DomainScenarioEngine.Result imageUploadPipeline(String mode, String runId) {
        String key = "image-" + runId;
        return switch (mode) {
            case "UNRESTRICTED" -> result("UNBOUNDED", "12MB 원본이 검증 없이 공개 저장소에 보존", 12_288, 12_288, key,
                    step("UPLOAD_ACCEPTED", "Web API", "WARNING", "확장자와 요청 헤더만 믿고 upload를 수락했다."),
                    step("ORIGINAL_STORED", "MinIO", "WARNING", "6000×4000 원본을 공개 경로에 그대로 저장했다."),
                    step("PAGE_DELIVERED", "Browser", "REJECTED", "목록 화면에서도 12MB 원본을 내려받았다."));
            case "REJECT_OVERSIZE" -> result("REJECTED", "10MB·픽셀 상한을 넘은 이미지를 저장 전에 차단", 12_288, 0, key,
                    step("LENGTH_CHECKED", "Web API", "SUCCESS", "Content-Length와 실제 stream byte 상한을 함께 확인했다."),
                    step("MAGIC_BYTES_CHECKED", "Decoder", "SUCCESS", "확장자가 아닌 magic bytes와 decode 가능 여부를 검사했다."),
                    step("PIXELS_CHECKED", "Image policy", "WARNING", "6000×4000 픽셀이 상품 이미지 상한을 초과했다."),
                    step("UPLOAD_REJECTED", "Web API", "REJECTED", "MinIO write 전에 413 정책 오류를 반환했다."));
            case "SYNC_OPTIMIZE" -> result("OPTIMIZED", "동기 WebP 변환으로 12MB를 1.8MB로 축소", 12_288, 1_843, key,
                    step("IMAGE_VALIDATED", "Web API", "SUCCESS", "MIME, magic bytes와 최대 픽셀 수를 확인했다."),
                    step("METADATA_STRIPPED", "Image processor", "SUCCESS", "EXIF 위치와 기기 정보를 제거했다."),
                    step("DISPLAY_RESIZED", "Image processor", "SUCCESS", "최대 1920px WebP display 이미지를 생성했다."),
                    step("VARIANTS_STORED", "MinIO", "SUCCESS", "display와 480px thumbnail을 immutable key로 저장했다."));
            case "ASYNC_OPTIMIZE" -> result("PROCESSING", "원본 격리 후 비동기 variant 생성 예약", 12_288, 0, key,
                    step("ORIGINAL_QUARANTINED", "MinIO", "SUCCESS", "원본을 공개되지 않는 임시 prefix에 저장했다."),
                    step("PROCESSING_RECORDED", "PostgreSQL", "SUCCESS", "asset 상태와 원본 checksum을 PROCESSING으로 기록했다."),
                    step("JOB_PUBLISHED", "Queue", "SUCCESS", "thumbnail·display 변환 job을 발행했다."),
                    step("PLACEHOLDER_RETURNED", "Web API", "WARNING", "변환 완료 전 placeholder와 asset ID를 반환했다."));
            case "ASYNC_COMPLETE" -> result("READY", "비동기 변환 완료와 원본 lifecycle 정리", 12_288, 2_048, key,
                    step("JOB_CONSUMED", "Image worker", "SUCCESS", "checksum 기준으로 중복 job을 확인했다."),
                    step("VARIANTS_CREATED", "Image worker", "SUCCESS", "thumbnail과 display variant를 생성했다."),
                    step("ASSET_READY", "PostgreSQL", "SUCCESS", "variant metadata와 READY 상태를 한 번 확정했다."),
                    step("ORIGINAL_LIFECYCLE_APPLIED", "MinIO", "SUCCESS", "정책에 따라 원본을 보존하거나 임시 원본을 삭제했다."));
            default -> throw unsupported(DomainScenarioType.IMAGE_UPLOAD_PIPELINE, mode);
        };
    }

    private static DomainScenarioEngine.Result privacyLifecycle(String mode, String runId) {
        String key = "privacy-" + runId;
        return switch (mode) {
            case "RAW_ACCESS" -> result("EXPOSED", "일반 역할에 개인정보 6개 필드 노출", 6, 6, key,
                    step("PROFILE_REQUESTED", "Support user", "SUCCESS", "고객 프로필 조회를 요청했다."),
                    step("RAW_PROJECTED", "API", "WARNING", "역할 구분 없이 원문 필드를 응답했다."),
                    step("ACCESS_REJECTED", "Privacy policy", "REJECTED", "최소 노출 원칙을 위반했다."));
            case "ROLE_MASKING" -> result("MASKED", "역할별 projection으로 원문 노출 제한", 6, 1, key,
                    step("ROLE_CHECKED", "Authorization", "SUCCESS", "CS 역할과 업무 목적을 확인했다."),
                    step("FIELDS_PROJECTED", "API", "SUCCESS", "전화번호 끝 4자리 외 필드를 마스킹했다."),
                    step("ACCESS_AUDITED", "Audit", "SUCCESS", "조회 사유와 접근자를 기록했다."));
            case "WITHDRAWAL" -> result("ISOLATED", "탈퇴 계정 식별자 분리와 token 폐기", 6, 2, key,
                    step("WITHDRAWAL_ACCEPTED", "Account", "SUCCESS", "탈퇴 요청과 기준 시각을 기록했다."),
                    step("TOKENS_REVOKED", "Authorization", "SUCCESS", "활성 session과 refresh token을 폐기했다."),
                    step("IDENTIFIERS_ISOLATED", "PostgreSQL", "SUCCESS", "즉시 파기 대상과 보존 예외를 분리했다."));
            case "PURGE_WITH_RETENTION" -> result("PURGED", "만료 대상 파기 후 재노출 검사 통과", 6, 0, key,
                    step("POLICY_RESOLVED", "Privacy policy", "SUCCESS", "필드별 보유기간과 예외 근거를 확인했다."),
                    step("EXPIRED_PURGED", "Scheduler", "SUCCESS", "만료된 원문 식별자를 파기했다."),
                    step("LOGS_REDACTED", "Loki", "SUCCESS", "로그와 export의 식별값을 검사했다."),
                    step("RESTORE_TESTED", "Backup", "SUCCESS", "복원본에 재파기 절차가 적용됨을 확인했다."));
            default -> throw unsupported(DomainScenarioType.PRIVACY_LIFECYCLE, mode);
        };
    }

    private static DomainScenarioEngine.Result spreadsheetOperations(String mode, String runId) {
        String key = "sheet-" + runId;
        return switch (mode) {
            case "IN_MEMORY_EXPORT" -> result("MEMORY_PRESSURE", "10만 행 전체 적재에서 memory pressure 발생", 120, 820, key,
                    step("ROWS_LOADED", "Spring", "WARNING", "10만 행을 한 번에 메모리에 적재하는 경로를 모델링했다."),
                    step("WORKBOOK_BUILT", "Excel", "WARNING", "모든 cell 객체를 flush 전까지 유지했다."),
                    step("LIMIT_EXCEEDED", "JVM", "REJECTED", "서비스 memory budget을 초과했다."));
            case "STREAMING_EXPORT" -> result("BOUNDED", "paging과 streaming으로 peak memory 96MB 유지", 820, 96, key,
                    step("SNAPSHOT_FIXED", "Query", "SUCCESS", "조회 기준 시각과 예상 10만 행을 고정했다."),
                    step("PAGES_READ", "PostgreSQL", "SUCCESS", "2,000행 단위 cursor로 읽었다."),
                    step("ROWS_FLUSHED", "Excel", "SUCCESS", "window 밖 row를 임시 파일로 flush했다."),
                    step("FILE_VERIFIED", "Backoffice", "SUCCESS", "행 수와 checksum을 확인했다."));
            case "INVALID_UPLOAD" -> result("REJECTED", "오류 18행을 격리하고 운영 반영 차단", 10_000, 0, key,
                    step("SCHEMA_CHECKED", "Upload", "SUCCESS", "파일 version과 필수 column을 확인했다."),
                    step("ROWS_VALIDATED", "Staging", "WARNING", "10,000행 중 업무 규칙 오류 18행을 찾았다."),
                    step("APPLY_BLOCKED", "Backoffice", "REJECTED", "검증 완료 전 운영 table 반영을 차단했다."));
            case "STAGED_IMPORT" -> result("APPLIED", "정상 9,982행 반영·오류 18행 보고", 10_000, 9_982, key,
                    step("REQUEST_KEY_CHECKED", "Upload", "SUCCESS", "중복 upload request를 확인했다."),
                    step("VALID_ROWS_STAGED", "PostgreSQL", "SUCCESS", "정상 9,982행을 staging에 적재했다."),
                    step("VALID_ROWS_APPLIED", "Backoffice", "SUCCESS", "조건부 upsert로 정상 건을 반영했다."),
                    step("ERROR_REPORT_CREATED", "Excel", "WARNING", "거절 사유가 포함된 18행 보고서를 만들었다."));
            default -> throw unsupported(DomainScenarioType.SPREADSHEET_OPERATIONS, mode);
        };
    }

    private static DomainScenarioEngine.Result businessMetrics(String mode, String runId) {
        String key = "metrics-" + runId;
        return switch (mode) {
            case "ONE_OFF_SQL" -> result("AMBIGUOUS", "동일 지표가 조건 차이로 143건 불일치", 12_480, 12_623, key,
                    step("REQUEST_INTERPRETED", "Developer", "WARNING", "가입자 수의 기간과 상태를 개별 해석했다."),
                    step("QUERY_EXECUTED", "PostgreSQL", "SUCCESS", "일회성 SQL로 결과를 추출했다."),
                    step("TOTALS_DIVERGED", "Backoffice", "REJECTED", "기존 보고서와 143건 차이가 발생했다."));
            case "DEFINED_METRIC" -> result("CONSISTENT", "지표 계약으로 화면과 SQL 합계 일치", 12_480, 12_480, key,
                    step("CONTRACT_LOADED", "Metrics", "SUCCESS", "KST cutoff와 탈퇴·테스트 계정 제외 조건을 적용했다."),
                    step("VERSIONED_QUERY_RUN", "PostgreSQL", "SUCCESS", "지표 version과 query hash를 기록했다."),
                    step("TOTAL_RECONCILED", "Backoffice", "SUCCESS", "정의서의 표본과 합계를 대조했다."));
            case "EXPORT_RECONCILIATION" -> result("RECONCILED", "화면·export 12,480건 일치", 12_480, 12_480, key,
                    step("FILTERS_SHARED", "Backoffice", "SUCCESS", "화면과 export가 같은 filter contract를 사용했다."),
                    step("EXPORT_GENERATED", "Excel", "SUCCESS", "기준 시각을 포함해 파일을 생성했다."),
                    step("COUNTS_MATCHED", "Reconciliation", "SUCCESS", "화면 합계와 export row 수가 일치했다."));
            case "INDEXED_QUERY" -> result("OPTIMIZED", "조회 계획 개선으로 2,800ms에서 180ms", 2_800, 180, key,
                    step("PLAN_CAPTURED", "PostgreSQL", "SUCCESS", "EXPLAIN으로 full scan과 정렬 비용을 확인했다."),
                    step("INDEX_APPLIED", "PostgreSQL", "SUCCESS", "기간·상태 조건에 맞는 index를 적용했다."),
                    step("RESULTS_COMPARED", "Metrics", "SUCCESS", "변경 전후 결과 집합이 같음을 검증했다."));
            default -> throw unsupported(DomainScenarioType.BUSINESS_METRICS, mode);
        };
    }

    private static DomainScenarioEngine.Result notificationDelivery(String mode, String runId) {
        String key = "notification-" + runId;
        return switch (mode) {
            case "NORMAL" -> result("DELIVERED", "provider callback으로 최종 전달 확정", 1, 1, key,
                    step("EVENT_COMMITTED", "Outbox", "SUCCESS", "결제 완료와 발송 요청을 함께 기록했다."),
                    step("MESSAGE_SENT", "Provider", "SUCCESS", "request key와 template으로 발송했다."),
                    step("DELIVERY_CONFIRMED", "Callback", "SUCCESS", "provider message ID의 전달 상태를 확정했다."));
            case "TIMEOUT_RETRY" -> result("RECONCILED", "timeout 뒤 상태 조회로 중복 발송 방지", 1, 1, key,
                    step("MESSAGE_SENT", "Provider", "SUCCESS", "발송 요청을 전송했다."),
                    step("RESPONSE_TIMEOUT", "HTTP client", "WARNING", "응답 없이 read timeout이 발생했다."),
                    step("STATUS_QUERIED", "Provider", "SUCCESS", "같은 request key의 처리 상태를 조회했다."),
                    step("DELIVERY_REUSED", "Notification", "SUCCESS", "새 발송 없이 기존 전달 결과를 반영했다."));
            case "RATE_LIMIT" -> result("RETRIED", "429 backoff 뒤 발송 성공", 1, 1, key,
                    step("RATE_LIMITED", "Provider", "WARNING", "HTTP 429와 Retry-After를 받았다."),
                    step("RETRY_SCHEDULED", "Queue", "SUCCESS", "jitter와 최대 횟수를 포함해 재시도를 예약했다."),
                    step("MESSAGE_DELIVERED", "Provider", "SUCCESS", "두 번째 attempt에서 전달됐다."));
            case "PERMANENT_FAILURE" -> result("REVIEW_REQUIRED", "잘못된 수신처를 DLQ로 격리", 1, 0, key,
                    step("RECIPIENT_REJECTED", "Provider", "REJECTED", "유효하지 않은 수신처 오류를 반환했다."),
                    step("RETRY_SKIPPED", "Notification", "SUCCESS", "영구 실패로 분류해 자동 재시도를 중단했다."),
                    step("DLQ_REDACTED", "Kafka", "WARNING", "민감값을 마스킹해 운영 검토 대상으로 보냈다."));
            case "MANUAL_REPLAY" -> result("REPLAYED", "운영자 재처리를 동일 request key로 한 번만 반영", 1, 1, key,
                    step("DLQ_REVIEWED", "Operator", "SUCCESS", "실패 원인과 수신처 정정 근거를 확인했다."),
                    step("REPLAY_AUTHORIZED", "Backoffice", "SUCCESS", "권한과 승인 ticket을 기록했다."),
                    step("KEY_REUSED", "Notification", "SUCCESS", "기존 request key로 중복 생성 여부를 확인했다."),
                    step("DELIVERY_CONFIRMED", "Provider", "SUCCESS", "재처리 attempt의 최종 전달을 확인했다."));
            default -> throw unsupported(DomainScenarioType.NOTIFICATION_DELIVERY, mode);
        };
    }

    private static DomainScenarioEngine.Result maintenanceMode(String mode, String runId) {
        String key = "maintenance-" + runId;
        return switch (mode) {
            case "NORMAL" -> result("NORMAL", "읽기·쓰기 8개 기능 정상 제공", 8, 8, key,
                    step("DEPENDENCIES_CHECKED", "Smoke", "SUCCESS", "핵심 의존성과 사용자 경로를 확인했다."),
                    step("FEATURES_OPEN", "Gateway", "SUCCESS", "읽기·쓰기 기능을 정상 제공했다."));
            case "DEGRADED" -> result("DEGRADED", "조회 5개 유지·위험한 쓰기 3개 제한", 8, 5, key,
                    step("SCOPE_DECIDED", "Incident", "SUCCESS", "결제 의존성 장애 범위를 확인했다."),
                    step("WRITE_GATES_CLOSED", "Gateway", "WARNING", "결제·포인트·주문 확정을 제한했다."),
                    step("READS_PRESERVED", "Web", "SUCCESS", "상품 조회와 공지를 계속 제공했다."));
            case "MAINTENANCE" -> result("MAINTENANCE", "versioned 공지와 전체 쓰기 차단 적용", 8, 2, key,
                    step("MODE_AUTHORIZED", "Operator", "SUCCESS", "승인된 운영자가 mode version을 변경했다."),
                    step("WRITES_BLOCKED", "Gateway", "WARNING", "모든 변경 요청을 일관된 오류 계약으로 차단했다."),
                    step("NOTICE_PUBLISHED", "Edge", "SUCCESS", "웹·앱·API용 공지 version을 배포했다."),
                    step("CACHE_VERIFIED", "CDN", "SUCCESS", "구형 공지가 남지 않았는지 확인했다."));
            case "RECOVERY" -> result("RECOVERED", "복구 smoke 통과 뒤 8개 기능 재개", 2, 8, key,
                    step("DEPENDENCY_RECOVERED", "Incident", "SUCCESS", "장애 의존성의 정상 신호를 확인했다."),
                    step("SMOKE_PASSED", "Synthetic test", "SUCCESS", "조회·결제·상태 조회 경로를 실행했다."),
                    step("BACKLOG_CHECKED", "Operations", "SUCCESS", "queue와 retry backlog가 정상임을 확인했다."),
                    step("NORMAL_RESTORED", "Gateway", "SUCCESS", "쓰기 gate를 열고 종료 공지를 반영했다."));
            default -> throw unsupported(DomainScenarioType.MAINTENANCE_MODE, mode);
        };
    }

    private static DomainScenarioEngine.Result result(String status, String headline, int before, int after,
                                                       String key, DomainScenarioEngine.Step... steps) {
        return new DomainScenarioEngine.Result(status, headline, before, after, key, 0, 0, 0, 0, 0, List.of(steps));
    }

    private static DomainScenarioEngine.Step step(String action, String actor, String status, String detail) {
        return new DomainScenarioEngine.Step(action, actor, status, detail);
    }

    private static IllegalArgumentException unsupported(DomainScenarioType type, String mode) {
        return new IllegalArgumentException("unsupported mode for " + type.slug() + ": " + mode);
    }
}
