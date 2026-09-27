package cloud.leneu.jaywiki.game.dto;

import java.time.OffsetDateTime;

/** 화면에 나가는 랭킹 한 줄. 원본 IP 등 내부 값은 어디에도 담기지 않는다. */
public record GameScoreDto(
        int rank,
        String name,
        int timeMs,
        OffsetDateTime createdAt
) {
}
