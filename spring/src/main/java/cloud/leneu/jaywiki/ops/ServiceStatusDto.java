package cloud.leneu.jaywiki.ops;

public record ServiceStatusDto(
        String key,
        String title,
        String namespace,
        String kind,
        String name,
        int desiredReplicas,
        int currentReplicas,
        int minReplicas,
        int maxReplicas,
        boolean available,
        String description
) {
}
