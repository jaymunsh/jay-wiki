package cloud.leneu.jaywiki.saga;

/** 참여자가 거절한 경우. 어느 파드가 거절했는지까지 들고 온다 — 화면이 단계마다 그것을 적는다. */
public class PaymentAuthorizationFailedException extends RuntimeException {
    private final String servedBy;

    public PaymentAuthorizationFailedException(String servedBy) {
        this.servedBy = servedBy;
    }

    public String servedBy() {
        return servedBy;
    }
}
