package cloud.leneu.jaywiki.common;

/** 사용자 입력이 잘못됨 → 400 (GlobalExceptionHandler 가 RFC7807 로 변환). */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
