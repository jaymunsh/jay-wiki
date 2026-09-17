package cloud.leneu.jaywiki.saga;

/**
 * 결제 서비스(payment-api) 자체에 도달하지 못한 인프라 장애.
 * 비즈니스 실패(PaymentAuthorizationFailedException, 409)와 구분해 503으로 응답한다.
 */
public class PaymentServiceUnavailableException extends RuntimeException {
    public PaymentServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
