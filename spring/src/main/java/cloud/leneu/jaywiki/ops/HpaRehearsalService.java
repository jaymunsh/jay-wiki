package cloud.leneu.jaywiki.ops;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HpaRehearsalService {
    private static final String LOCK = "ops:hpa:lock";
    private static final String CURRENT = "ops:hpa:current";
    private static final String LATEST = "ops:hpa:latest";
    private static final Duration RUN_TTL = Duration.ofDays(7);
    private static final Duration LOCK_TTL = Duration.ofMinutes(15);
    private static final int MAX_WORKERS = 16;
    private final HpaRehearsalGateway gateway;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    /** 워커 수는 화면이 고르지만 클러스터를 지켜야 하므로 여기서 가둔다. */
    static int clampWorkers(int workers) {
        return Math.max(1, Math.min(workers, MAX_WORKERS));
    }

    public HpaRehearsalView start(boolean canControl, int workers) {
        String runId = UUID.randomUUID().toString();
        if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(LOCK, runId, LOCK_TTL))) {
            throw new IllegalStateException("HPA rehearsal is already running");
        }
        try {
            OffsetDateTime now = OffsetDateTime.now();
            redis.opsForValue().set(CURRENT, runId, LOCK_TTL);
            redis.opsForValue().set(LATEST, runId, RUN_TTL);
            redis.opsForHash().putAll(runKey(runId), Map.of(
                    "startedAt", now.toString(),
                    "status", "STARTING"));
            redis.expire(runKey(runId), RUN_TTL);
            recordEvent(runId, "STARTING", now);
            gateway.start(runId, clampWorkers(workers));
            return view(runId, canControl);
        } catch (RuntimeException e) {
            redis.delete(LOCK);
            redis.delete(CURRENT);
            throw e;
        }
    }

    public HpaRehearsalView current(boolean canControl) {
        String runId = redis.opsForValue().get(CURRENT);
        if (runId == null) runId = redis.opsForValue().get(LATEST);
        return view(runId, canControl);
    }

    public HpaRehearsalView cancel(boolean canControl) {
        String runId = redis.opsForValue().get(CURRENT);
        if (runId == null) throw new IllegalStateException("No HPA rehearsal is running");
        gateway.cancel(runId);
        updateStatus(runId, "CANCELLED", OffsetDateTime.now());
        redis.delete(LOCK);
        redis.delete(CURRENT);
        return view(runId, canControl);
    }

    private HpaRehearsalView view(String runId, boolean canControl) {
        HpaRuntimeSnapshot runtime = gateway.read(runId);
        if (runId == null) {
            return new HpaRehearsalView(null, runtime.available() ? "IDLE" : "UNAVAILABLE", false,
                    runtime.available(), canControl, null, OffsetDateTime.now(), runtime.cpuUtilization(),
                    runtime.targetCpuUtilization(), runtime.desiredReplicas(), runtime.readyReplicas(),
                    pods(runtime, canControl), List.of(), null);
        }
        OffsetDateTime startedAt = parse(redis.opsForHash().get(runKey(runId), "startedAt"));
        String previous = string(redis.opsForHash().get(runKey(runId), "status"), "STARTING");
        String next = derive(previous, runtime);
        OffsetDateTime now = OffsetDateTime.now();
        if (!previous.equals(next)) updateStatus(runId, next, now);
        if (terminal(next)) {
            redis.delete(LOCK);
            redis.delete(CURRENT);
        }
        return new HpaRehearsalView(runId, next, !terminal(next), runtime.available(), canControl,
                startedAt, now, runtime.cpuUtilization(), runtime.targetCpuUtilization(),
                runtime.desiredReplicas(), runtime.readyReplicas(), pods(runtime, canControl),
                events(runId), load(runId, runtime));
    }

    /**
     * 부하 Job 은 끝나고 5분이면 사라진다. 그때 통계도 같이 사라지면 기준선이 안 남으므로
     * 읽히는 동안 레디스에 옮겨 두고, 이후에는 옮겨 둔 것을 돌려준다.
     */
    private HpaRuntimeSnapshot.Load load(String runId, HpaRuntimeSnapshot runtime) {
        try {
            if (runtime.load() != null) {
                redis.opsForHash().put(runKey(runId), "load", mapper.writeValueAsString(runtime.load()));
                return runtime.load();
            }
            Object stored = redis.opsForHash().get(runKey(runId), "load");
            return stored == null ? null : mapper.readValue(stored.toString(), HpaRuntimeSnapshot.Load.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("HPA load stats could not be stored", e);
        }
    }

    private List<HpaRehearsalView.Pod> pods(HpaRuntimeSnapshot runtime, boolean canControl) {
        List<HpaRehearsalView.Pod> result = new ArrayList<>();
        int index = 1;
        for (HpaRuntimeSnapshot.Pod pod : runtime.pods()) {
            result.add(new HpaRehearsalView.Pod(canControl ? pod.name() : "Pod " + index++, pod.phase(),
                    pod.ready(), pod.restarts(), pod.startedAt(), pod.cpuMilli(), pod.memoryMi(), pod.image()));
        }
        return List.copyOf(result);
    }

    static String derive(String previous, HpaRuntimeSnapshot runtime) {
        if (!runtime.available()) return "UNAVAILABLE";
        if ("CANCELLED".equals(previous)) return previous;
        if (runtime.jobState() == HpaRuntimeSnapshot.JobState.FAILED) return "FAILED";
        boolean scaledOut = List.of("SCALED_OUT", "STABILIZING").contains(previous);
        if (runtime.desiredReplicas() >= 2 || runtime.readyReplicas() >= 2) {
            return runtime.jobState() == HpaRuntimeSnapshot.JobState.SUCCEEDED ? "STABILIZING" : "SCALED_OUT";
        }
        if (scaledOut) {
            return runtime.jobState() == HpaRuntimeSnapshot.JobState.ACTIVE ? "SCALED_OUT" : "COMPLETED";
        }
        if (runtime.jobState() == HpaRuntimeSnapshot.JobState.SUCCEEDED) {
            return "NO_SCALE";
        }
        if (runtime.jobState() == HpaRuntimeSnapshot.JobState.ACTIVE) return "LOADING";
        return previous;
    }

    private void updateStatus(String runId, String status, OffsetDateTime at) {
        redis.opsForHash().put(runKey(runId), "status", status);
        recordEvent(runId, status, at);
    }

    private void recordEvent(String runId, String phase, OffsetDateTime at) {
        try {
            redis.opsForList().rightPush(eventsKey(runId), mapper.writeValueAsString(Map.of(
                    "phase", phase, "at", at.toString())));
            redis.expire(eventsKey(runId), RUN_TTL);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("HPA event could not be serialized", e);
        }
    }

    private List<HpaRehearsalView.Event> events(String runId) {
        List<String> values = redis.opsForList().range(eventsKey(runId), 0, -1);
        if (values == null) return List.of();
        return values.stream().map(value -> {
            try {
                @SuppressWarnings("unchecked") Map<String, String> event = mapper.readValue(value, Map.class);
                return new HpaRehearsalView.Event(event.get("phase"), OffsetDateTime.parse(event.get("at")));
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("HPA event could not be read", e);
            }
        }).toList();
    }

    private static boolean terminal(String status) {
        return List.of("COMPLETED", "NO_SCALE", "FAILED", "CANCELLED").contains(status);
    }

    private static OffsetDateTime parse(Object value) {
        return value == null ? null : OffsetDateTime.parse(value.toString());
    }

    private static String string(Object value, String fallback) {
        return value == null ? fallback : value.toString();
    }

    private static String runKey(String runId) { return "ops:hpa:run:" + runId; }
    private static String eventsKey(String runId) { return runKey(runId) + ":events"; }
}
