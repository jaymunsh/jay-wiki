package cloud.leneu.jaywiki.board.dto;

import cloud.leneu.jaywiki.board.CommunityPost;

import java.time.OffsetDateTime;

/** 상세용(본문 포함). views 는 Redis 실시간 증가분을 합산한 값. */
public record PostDto(
        Long id,
        String title,
        String content,
        String authorName,
        String authorType,
        long views,
        int commentCount,
        boolean hasPassword,   // 본인 삭제 UI 노출 여부
        OffsetDateTime createdAt
) {
    public static PostDto from(CommunityPost p, long views) {
        return new PostDto(p.getId(), p.getTitle(), p.getContent(), p.getAuthorName(),
                p.getAuthorType(), views, p.getCommentCount(),
                p.getPasswordHash() != null, p.getCreatedAt());
    }
}
