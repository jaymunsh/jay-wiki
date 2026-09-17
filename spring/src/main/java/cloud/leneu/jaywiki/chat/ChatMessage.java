package cloud.leneu.jaywiki.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatMessage(
        @NotBlank @Size(max = 32) String type,
        @Size(max = 500) String text
) {
}
