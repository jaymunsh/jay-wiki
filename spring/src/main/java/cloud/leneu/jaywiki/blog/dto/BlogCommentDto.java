package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/** 화면에 나가는 댓글. ipPrefix 는 앞 2옥텟이고 원본 IP 는 어디에도 담기지 않는다. */
public record BlogCommentDto(
        Long id,
        String authorName,
        String ipPrefix,
        String body,
        OffsetDateTime createdAt
) {
}
