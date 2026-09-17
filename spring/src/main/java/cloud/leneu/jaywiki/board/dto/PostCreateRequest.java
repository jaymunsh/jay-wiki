package cloud.leneu.jaywiki.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 익명 글 작성 요청. authorName/password 는 선택. */
public record PostCreateRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank String content,
        @Size(max = 30) String authorName,   // 없으면 '익명'
        @Size(max = 60) String password      // 있으면 본인 삭제용으로 BCrypt 저장
) {}
