package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** 글 화면. 본문과 태그를 포함한다. */
public record BlogPostDto(
        Long id,
        String slug,
        String title,
        String summary,
        String body,
        String categorySlug,
        String categoryName,
        String coverImageUrl,
        OffsetDateTime publishedAt,
        OffsetDateTime updatedAt,
        boolean tocEnabled,
        List<String> tags,
        /** 글쓴이가 지정한 시리즈 연결. 없으면 null 이고 화면이 그 칸을 안 그린다. */
        BlogPostSummaryDto prevPost,
        BlogPostSummaryDto nextPost
) {
}
