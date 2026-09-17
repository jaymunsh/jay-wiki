package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** 관리 화면용. 공개 DTO 와 달리 draft 와 본문·조회수를 함께 담는다. */
public record BlogAdminPostDto(
        Long id,
        String slug,
        String title,
        String summary,
        String body,
        Long categoryId,
        String categorySlug,
        String categoryName,
        String coverAssetId,
        String status,
        OffsetDateTime publishedAt,
        OffsetDateTime updatedAt,
        long viewCount,
        boolean tocEnabled,
        List<String> tags,
        Long prevPostId,
        Long nextPostId
) {
}
