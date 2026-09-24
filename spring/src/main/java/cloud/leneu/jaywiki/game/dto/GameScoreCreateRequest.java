package cloud.leneu.jaywiki.game.dto;

/** 익명 기록 등록. 암호는 두지 않는다 -- 기록은 지우는 기능이 없고 검증 값은 서버가 본다. */
public record GameScoreCreateRequest(String name, Integer timeMs) {
}
