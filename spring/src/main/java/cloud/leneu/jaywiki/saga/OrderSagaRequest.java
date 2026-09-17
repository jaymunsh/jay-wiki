package cloud.leneu.jaywiki.saga;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record OrderSagaRequest(
        // 구매자는 선택이다. 기존 데모 주문에는 없고, 없으면 화면이 '구매자 없음'으로 그린다.
        String customerId,
        @NotBlank String productCode,
        @Min(1) int quantity,
        @NotNull OrderSagaFailAt failAt,
        @NotBlank String idempotencyKey
) {
}
