package cloud.leneu.jaywiki.ops;

public enum WorkloadKind {
    DEPLOYMENT("Deployment", "deployments"),
    STATEFUL_SET("StatefulSet", "statefulsets");

    private final String displayName;
    private final String apiResource;

    WorkloadKind(String displayName, String apiResource) {
        this.displayName = displayName;
        this.apiResource = apiResource;
    }

    public String displayName() {
        return displayName;
    }

    public String apiResource() {
        return apiResource;
    }
}
