package cloud.leneu.jaywiki.domainlab;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DomainScenarioService {
    private final DomainScenarioEngine engine;
    private final DomainScenarioRunRepository runs;
    private final DomainScenarioStepRepository steps;

    @Transactional
    public DomainScenarioView run(DomainScenarioType type, String mode) {
        String runId = type.slug() + "_" + UUID.randomUUID().toString().replace("-", "");
        DomainScenarioEngine.Result result = engine.run(type, mode, runId);
        DomainScenarioRun run = new DomainScenarioRun();
        run.setRunId(runId);
        run.setScenarioType(type.slug());
        run.setMode(mode);
        run.setStatus(result.status());
        run.setHeadline(result.headline());
        run.setBeforeAmount(result.beforeAmount());
        run.setAfterAmount(result.afterAmount());
        run.setIdempotencyKey(result.idempotencyKey());
        run.setP95Ms(result.p95Ms());
        run.setRejectedCount(result.rejectedCount());
        run.setQueueLag(result.queueLag());
        run.setReplicas(result.replicas());
        run.setRecoverySeconds(result.recoverySeconds());
        run.setCreatedAt(OffsetDateTime.now());
        runs.save(run);

        for (int index = 0; index < result.steps().size(); index++) {
            DomainScenarioEngine.Step source = result.steps().get(index);
            DomainScenarioStep step = new DomainScenarioStep();
            step.setRunId(runId);
            step.setSequenceNo(index + 1);
            step.setAction(source.action());
            step.setActor(source.actor());
            step.setStatus(source.status());
            step.setDetail(source.detail());
            steps.save(step);
        }
        return view(run);
    }

    @Transactional(readOnly = true)
    public List<DomainScenarioView> recent(DomainScenarioType type, int size) {
        int safeSize = Math.max(1, Math.min(size, 12));
        return runs.findByScenarioTypeOrderByCreatedAtDesc(type.slug(), PageRequest.of(0, safeSize))
                .stream().map(this::view).toList();
    }

    DomainScenarioView view(DomainScenarioRun run) {
        List<DomainScenarioView.StepView> stepViews = steps.findByRunIdOrderBySequenceNo(run.getRunId()).stream()
                .map(step -> new DomainScenarioView.StepView(step.getSequenceNo(), step.getAction(),
                        step.getActor(), step.getStatus(), step.getDetail()))
                .toList();
        return new DomainScenarioView(run.getRunId(), run.getScenarioType(), run.getMode(), run.getStatus(),
                run.getHeadline(), run.getBeforeAmount(), run.getAfterAmount(), run.getIdempotencyKey(),
                run.getHttpStatus(), run.getAttemptCount(), run.getElapsedMs(), run.getP95Ms(),
                run.getRejectedCount(), run.getQueueLag(), run.getReplicas(), run.getRecoverySeconds(),
                run.getCreatedAt(), stepViews);
    }
}
