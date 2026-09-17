package cloud.leneu.jaywiki.ops;

public record ServiceControlTarget(
        String key,
        String title,
        String namespace,
        WorkloadKind kind,
        String name,
        int minReplicas,
        int maxReplicas,
        String description
) {
    public boolean accepts(int replicas) {
        return replicas >= minReplicas && replicas <= maxReplicas;
    }
}
