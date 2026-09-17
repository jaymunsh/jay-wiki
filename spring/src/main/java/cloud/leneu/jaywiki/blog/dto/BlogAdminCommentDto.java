package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/**
 * 관리 화면용 댓글. ipPrefix 는 앞 2옥텟이고 원본 IP 는 DB 에도 없다.
 * 화면은 121.135.*.* 형태로 보여준다 — 뒤 두 옥텟은 애초에 저장하지 않았다.
 */
public record BlogAdminCommentDto(
        Long id,
        Long postId,
        String postTitle,
        String authorName,
        String ipPrefix,
        String body,
        OffsetDateTime createdAt,
        OffsetDateTime deletedAt
) {
}
