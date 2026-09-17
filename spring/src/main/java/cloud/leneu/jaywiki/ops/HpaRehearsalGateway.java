package cloud.leneu.jaywiki.ops;

public interface HpaRehearsalGateway {
    void start(String runId, int workers);
    void cancel(String runId);
    HpaRuntimeSnapshot read(String runId);
}
