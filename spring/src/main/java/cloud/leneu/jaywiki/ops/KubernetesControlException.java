package cloud.leneu.jaywiki.ops;

public class KubernetesControlException extends RuntimeException {

    public KubernetesControlException(String message) {
        super(message);
    }

    public KubernetesControlException(String message, Throwable cause) {
        super(message, cause);
    }
}
