package cloud.leneu.jaywiki.saga;

/**
 * 배송 서비스(shipping-api) 자체에 도달하지 못한 인프라 장애.
 * 비즈니스 실패(ShippingRequestFailedException, 409)와 구분해 503으로 응답한다.
 */
public class ShippingServiceUnavailableException extends RuntimeException {
    public ShippingServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
