package cloud.leneu.jaywiki.wiki.dto;

import cloud.leneu.jaywiki.wiki.WikiArticle;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 문서 전체 응답 (본문 포함). */
public record ArticleDto(
        String slug,
        String parentId,
        String title,
        String summary,
        String body,
        String kind,
        String status,
        String tags,
        LocalDate lastReview,
        int sortOrder,
        boolean tocEnabled,
        int version,
        long viewCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static ArticleDto from(WikiArticle a) {
        return new ArticleDto(
                a.getSlug(), a.getParentId(), a.getTitle(), a.getSummary(), a.getBody(),
                a.getKind(), a.getStatus(), a.getTags(), a.getLastReview(),
                a.getSortOrder(), a.isTocEnabled(), a.getVersion(), a.getViewCount(),
                a.getCreatedAt(), a.getUpdatedAt());
    }
}
