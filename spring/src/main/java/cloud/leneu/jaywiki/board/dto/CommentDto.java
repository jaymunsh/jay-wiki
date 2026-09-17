package cloud.leneu.jaywiki.board.dto;

import cloud.leneu.jaywiki.board.CommunityComment;

import java.time.OffsetDateTime;

public record CommentDto(
        Long id,
        String content,
        String authorName,
        String authorType,
        OffsetDateTime createdAt
) {
    public static CommentDto from(CommunityComment c) {
        return new CommentDto(c.getId(), c.getContent(), c.getAuthorName(),
                c.getAuthorType(), c.getCreatedAt());
    }
}
