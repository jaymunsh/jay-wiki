package cloud.leneu.jaywiki.ops;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ServiceScaleRequest(
        @NotNull
        @Min(0)
        @Max(2)
        Integer replicas
) {
}
