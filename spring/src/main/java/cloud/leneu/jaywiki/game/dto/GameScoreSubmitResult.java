package cloud.leneu.jaywiki.game.dto;

import java.util.List;

/** 등록 직후 화면에 필요한 것 -- 방금 기록의 전체 순위와 새로운 TOP 5. */
public record GameScoreSubmitResult(int rank, List<GameScoreDto> top) {
}
