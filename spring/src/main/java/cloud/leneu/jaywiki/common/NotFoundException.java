package cloud.leneu.jaywiki.common;

/** 리소스 없음 → 404 (GlobalExceptionHandler 가 RFC7807 로 변환). */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
