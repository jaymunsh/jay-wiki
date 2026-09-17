package cloud.leneu.jaywiki.board.dto;

import cloud.leneu.jaywiki.board.CommunityPost;

import java.time.OffsetDateTime;

/** 목록용 요약(본문 제외 — 10만 건 목록을 가볍게). */
public record PostSummaryDto(
        Long id,
        String title,
        String authorName,
        String authorType,
        int views,
        int commentCount,
        OffsetDateTime createdAt
) {
    public static PostSummaryDto from(CommunityPost p) {
        return new PostSummaryDto(p.getId(), p.getTitle(), p.getAuthorName(),
                p.getAuthorType(), p.getViews(), p.getCommentCount(), p.getCreatedAt());
    }
}
