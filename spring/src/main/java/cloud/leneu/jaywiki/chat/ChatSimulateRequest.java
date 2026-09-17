package cloud.leneu.jaywiki.chat;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ChatSimulateRequest(@Min(1) @Max(20) int count) {
}
