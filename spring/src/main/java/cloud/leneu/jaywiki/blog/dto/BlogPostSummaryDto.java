package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/** 목록 한 줄. 본문을 담지 않는다. 대표 이미지는 URL 로 이미 풀어서 준다. */
public record BlogPostSummaryDto(
        Long id,
        String slug,
        String title,
        String summary,
        String categorySlug,
        String categoryName,
        String coverImageUrl,
        OffsetDateTime publishedAt,
        OffsetDateTime updatedAt
) {
}
