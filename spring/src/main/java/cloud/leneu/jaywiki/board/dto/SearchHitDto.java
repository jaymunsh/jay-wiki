package cloud.leneu.jaywiki.board.dto;

import cloud.leneu.jaywiki.board.CommunityPost;

import java.time.OffsetDateTime;

public record SearchHitDto(
        Long id,
        String title,
        String authorName,
        String authorType,
        int views,
        int commentCount,
        OffsetDateTime createdAt,
        String snippet
) {
    public static SearchHitDto from(CommunityPost p, String snippet) {
        return new SearchHitDto(p.getId(), p.getTitle(), p.getAuthorName(),
                p.getAuthorType(), p.getViews(), p.getCommentCount(), p.getCreatedAt(), snippet);
    }
}
