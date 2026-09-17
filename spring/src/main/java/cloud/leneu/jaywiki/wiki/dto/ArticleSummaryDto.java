package cloud.leneu.jaywiki.wiki.dto;

import cloud.leneu.jaywiki.wiki.WikiArticle;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 목록/탭 트리용 요약(본문 제외 — 가볍게). */
public record ArticleSummaryDto(
        String slug,
        String parentId,
        String title,
        String summary,
        String kind,
        String status,
        LocalDate lastReview,
        int sortOrder,
        long viewCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static ArticleSummaryDto from(WikiArticle a) {
        return new ArticleSummaryDto(
                a.getSlug(), a.getParentId(), a.getTitle(), a.getSummary(),
                a.getKind(), a.getStatus(), a.getLastReview(), a.getSortOrder(), a.getViewCount(),
                a.getCreatedAt(), a.getUpdatedAt());
    }
}
