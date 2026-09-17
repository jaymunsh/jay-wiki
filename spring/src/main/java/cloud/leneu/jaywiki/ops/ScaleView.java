package cloud.leneu.jaywiki.ops;

public record ScaleView(int desiredReplicas, int currentReplicas) {
}
