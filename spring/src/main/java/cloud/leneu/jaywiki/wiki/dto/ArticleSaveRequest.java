package cloud.leneu.jaywiki.wiki.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;

/** 문서 생성/수정 요청. */
public record ArticleSaveRequest(
        @NotBlank @Pattern(regexp = "[a-z0-9][a-z0-9-_]*", message = "slug 는 영문소문자/숫자/-_") String slug,
        @NotBlank String parentId,
        @NotBlank String title,
        String summary,
        String body,
        String kind,
        String status,
        String tags,
        LocalDate lastReview,
        Integer sortOrder,
        Boolean tocEnabled, // 목차 노출 (null = false)
        String editor       // 작성자(없으면 'admin')
) {
    /** tocEnabled 이전 시그니처. 기존 호출부(테스트·동기화)가 그대로 쓴다. */
    public ArticleSaveRequest(String slug, String parentId, String title, String summary, String body,
                              String kind, String status, String tags, LocalDate lastReview,
                              Integer sortOrder, String editor) {
        this(slug, parentId, title, summary, body, kind, status, tags, lastReview, sortOrder, null, editor);
    }
}
