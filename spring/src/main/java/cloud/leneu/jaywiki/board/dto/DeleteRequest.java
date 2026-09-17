package cloud.leneu.jaywiki.board.dto;

/** 익명 글 본인 삭제 — 작성 시 정한 비밀번호 확인. */
public record DeleteRequest(String password) {}
