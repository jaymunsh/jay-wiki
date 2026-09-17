package cloud.leneu.jaywiki.kafka;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record KafkaDemoCreateOrderRequest(
        @NotBlank String productCode,
        @Min(1) @Max(5) int quantity,
        @NotNull KafkaDemoFailMode failMode
) {
}
