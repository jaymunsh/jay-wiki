package cloud.leneu.jaywiki.wiki.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** 탭 생성/수정 요청. */
public record TabSaveRequest(
        @NotBlank @Pattern(regexp = "[a-z0-9][a-z0-9-_]*", message = "tabId 는 영문소문자/숫자/-_") String tabId,
        @NotBlank String title,
        Integer sortOrder
) {}
