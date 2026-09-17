package cloud.leneu.jaywiki.wiki.dto;

import cloud.leneu.jaywiki.wiki.WikiRevision;

import java.time.OffsetDateTime;

/** 버전 이력 응답. list 용은 body 를 비워(가볍게), 단건 조회는 body 포함. */
public record RevisionDto(
        int version,
        String title,
        String body,
        String editor,
        OffsetDateTime createdAt
) {
    public static RevisionDto summary(WikiRevision r) {
        return new RevisionDto(r.getVersion(), r.getTitle(), null, r.getEditor(), r.getCreatedAt());
    }
    public static RevisionDto full(WikiRevision r) {
        return new RevisionDto(r.getVersion(), r.getTitle(), r.getBody(), r.getEditor(), r.getCreatedAt());
    }
}
