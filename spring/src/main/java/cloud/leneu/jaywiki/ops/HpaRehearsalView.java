package cloud.leneu.jaywiki.ops;

import java.time.OffsetDateTime;
import java.util.List;

public record HpaRehearsalView(
        String runId,
        String status,
        boolean live,
        boolean available,
        boolean canControl,
        OffsetDateTime startedAt,
        OffsetDateTime updatedAt,
        Integer cpuUtilization,
        int targetCpuUtilization,
        int desiredReplicas,
        int readyReplicas,
        List<Pod> pods,
        List<Event> events,
        HpaRuntimeSnapshot.Load load
) {
    public record Pod(String name, String phase, boolean ready, int restarts, OffsetDateTime startedAt,
                      Long cpuMilli, Long memoryMi, String image) {}
    public record Event(String phase, OffsetDateTime at) {}
}
