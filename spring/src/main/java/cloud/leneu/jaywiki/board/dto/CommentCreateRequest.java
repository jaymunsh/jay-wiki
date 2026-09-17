package cloud.leneu.jaywiki.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentCreateRequest(
        @NotBlank String content,
        @Size(max = 30) String authorName   // 없으면 '익명'
) {}
