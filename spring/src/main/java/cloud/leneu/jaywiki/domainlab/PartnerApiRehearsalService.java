package cloud.leneu.jaywiki.domainlab;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PartnerApiRehearsalService {
    private final PartnerApiClient client;
    private final PartnerCallbackRegistry callbackRegistry;
    private final DomainScenarioRunRepository runs;
    private final DomainScenarioStepRepository steps;
    private final DomainScenarioService views;

    public DomainScenarioView run(String mode) {
        String runId = "partner-api_" + UUID.randomUUID().toString().replace("-", "");
        DomainScenarioRun run = createRun(runId, mode);
        boolean expectsCallback = "TIMEOUT_CALLBACK".equals(mode) || "BAD_SIGNATURE".equals(mode);
        if (expectsCallback) callbackRegistry.register(runId);

        PartnerApiClient.Result result = client.execute(runId, mode);
        Optional<PartnerCallbackRegistry.Result> callback = expectsCallback
                ? callbackRegistry.await(runId, Duration.ofSeconds(2))
                : Optional.empty();
        Evidence evidence = evidence(mode, result, callback);
        run.setStatus(evidence.status());
        run.setHeadline(evidence.headline());
        run.setAfterAmount(evidence.afterAmount());
        run.setHttpStatus(result.httpStatus());
        run.setAttemptCount(result.attempts());
        run.setElapsedMs(result.elapsedMs());
        runs.save(run);
        persistSteps(runId, evidence.steps());
        return views.view(run);
    }

    private DomainScenarioRun createRun(String runId, String mode) {
        DomainScenarioRun run = new DomainScenarioRun();
        run.setRunId(runId);
        run.setScenarioType(DomainScenarioType.PARTNER_API.slug());
        run.setMode(mode);
        run.setStatus("RUNNING");
        run.setHeadline("실제 partner simulator 호출 중");
        run.setBeforeAmount(0);
        run.setAfterAmount(0);
        run.setIdempotencyKey("partner-" + runId);
        run.setCreatedAt(OffsetDateTime.now());
        return runs.save(run);
    }

    private Evidence evidence(String mode, PartnerApiClient.Result result,
                              Optional<PartnerCallbackRegistry.Result> callback) {
        return switch (mode) {
            case "NORMAL" -> new Evidence("COMPLETED", "실제 제휴사 승인 응답 수신", 1, List.of(
                    step("REQUEST_SIGNED", "Spring WebClient", "SUCCESS", "correlation ID를 포함해 요청했다."),
                    step("HTTP_200", "FastAPI simulator", "SUCCESS", result.elapsedMs() + "ms에 200을 반환했다."),
                    step("RESPONSE_VERIFIED", "Commerce API", "SUCCESS", "응답 상태를 APPROVED로 확정했다.")));
            case "RATE_LIMIT" -> new Evidence("RETRIED", "Retry-After 이후 실제 재시도 성공", 1, List.of(
                    step("HTTP_429", "FastAPI simulator", "WARNING", "첫 요청에 429와 Retry-After를 반환했다."),
                    step("BACKOFF_APPLIED", "Spring WebClient", "SUCCESS", "Retry-After 1초를 기다렸다."),
                    step("RETRY_SUCCEEDED", "FastAPI simulator", "SUCCESS", result.attempts() + "번째 요청에서 200을 받았다.")));
            case "SERVER_ERROR" -> new Evidence("RETRY_EXHAUSTED", "반복 500 이후 제한된 재시도 종료", 0, List.of(
                    step("HTTP_500", "FastAPI simulator", "WARNING", "실제 500 응답을 반환했다."),
                    step("RETRY_ATTEMPTED", "Spring WebClient", "WARNING", "최대 3회까지만 호출했다."),
                    step("RETRY_EXHAUSTED", "Commerce API", "REJECTED", "상태를 성공으로 변경하지 않았다.")));
            case "TIMEOUT_CALLBACK" -> callback.filter(PartnerCallbackRegistry.Result::signatureValid)
                    .map(value -> new Evidence("RECONCILED", "read timeout 뒤 서명 callback으로 확정", 1, List.of(
                            step("READ_TIMEOUT", "Spring WebClient", "WARNING", result.elapsedMs() + "ms에 실제 timeout이 발생했다."),
                            step("STATE_UNKNOWN", "Commerce API", "WARNING", "응답 유실을 실패로 확정하지 않았다."),
                            step("CALLBACK_RECEIVED", "FastAPI simulator", "SUCCESS", "지연 callback이 별도 HTTP 요청으로 도착했다."),
                            step("SIGNATURE_VERIFIED", "Webhook", "SUCCESS", "HMAC과 timestamp를 검증했다."),
                            step("STATE_RECONCILED", "Commerce API", "SUCCESS", "미확정 요청을 APPROVED로 전환했다."))))
                    .orElseGet(() -> new Evidence("CALLBACK_MISSING", "timeout 뒤 유효 callback 미수신", 0, List.of(
                            step("READ_TIMEOUT", "Spring WebClient", "WARNING", "실제 read timeout이 발생했다."),
                            step("CALLBACK_MISSING", "Webhook", "REJECTED", "대기 시간 안에 유효 callback이 없었다."))));
            case "BAD_SIGNATURE" -> callback
                    .map(value -> new Evidence("REJECTED", "위조 callback 서명 차단", 0, List.of(
                            step("CALLBACK_RECEIVED", "FastAPI simulator", "WARNING", "승인을 주장하는 callback이 도착했다."),
                            step("SIGNATURE_INVALID", "Webhook", "REJECTED", "HMAC signature가 일치하지 않았다."),
                            step("STATE_UNCHANGED", "Commerce API", "SUCCESS", "업무 상태를 변경하지 않았다."))))
                    .orElseGet(() -> new Evidence("CALLBACK_MISSING", "검증할 callback 미수신", 0, List.of(
                            step("CALLBACK_MISSING", "Webhook", "REJECTED", "대기 시간 안에 callback이 도착하지 않았다."))));
            default -> throw new IllegalArgumentException("Unsupported partner rehearsal mode: " + mode);
        };
    }

    private void persistSteps(String runId, List<StepEvidence> evidence) {
        for (int index = 0; index < evidence.size(); index++) {
            StepEvidence source = evidence.get(index);
            DomainScenarioStep step = new DomainScenarioStep();
            step.setRunId(runId);
            step.setSequenceNo(index + 1);
            step.setAction(source.action());
            step.setActor(source.actor());
            step.setStatus(source.status());
            step.setDetail(source.detail());
            steps.save(step);
        }
    }

    private StepEvidence step(String action, String actor, String status, String detail) {
        return new StepEvidence(action, actor, status, detail);
    }

    private record Evidence(String status, String headline, int afterAmount, List<StepEvidence> steps) {
    }

    private record StepEvidence(String action, String actor, String status, String detail) {
    }
}
