package cloud.leneu.jaywiki.ops;

public interface KubernetesScaleGateway {

    ScaleView read(ServiceControlTarget target);

    ScaleView scale(ServiceControlTarget target, int replicas);
}
