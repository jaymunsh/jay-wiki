package cloud.leneu.jaywiki.ops;

import java.time.OffsetDateTime;
import java.util.List;

public record HpaRuntimeSnapshot(
        boolean available,
        Integer cpuUtilization,
        int targetCpuUtilization,
        int desiredReplicas,
        int readyReplicas,
        JobState jobState,
        List<Pod> pods,
        Load load
) {
    public enum JobState { NONE, ACTIVE, SUCCEEDED, FAILED }

    public record Pod(
            String name,
            String phase,
            boolean ready,
            int restarts,
            OffsetDateTime startedAt,
            Long cpuMilli,
            Long memoryMi,
            String image
    ) {}

    /** 부하 Job 이 스스로 센 값이다. 클러스터가 아니라 요청을 보낸 쪽에서 나온다. */
    public record Load(int workers, long requests, long failed, long avgMs, long maxMs) {}

    public static HpaRuntimeSnapshot unavailable() {
        return new HpaRuntimeSnapshot(false, null, 60, 0, 0, JobState.NONE, List.of(), null);
    }
}
