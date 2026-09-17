package cloud.leneu.jaywiki.blog.dto;

/** 로그인 없이 쓰므로 이름과 암호를 함께 받는다. 암호는 본인 삭제용이다. */
public record BlogCommentCreateRequest(String authorName, String password, String body) {
}
