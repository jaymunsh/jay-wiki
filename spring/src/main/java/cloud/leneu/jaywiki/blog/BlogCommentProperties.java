package cloud.leneu.jaywiki.blog;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * salt 가 유출되면 IP 역산이 쉬워진다. 운영에서는 Kubernetes Secret 으로 주입하고
 * 코드나 설정 파일에 실제 값을 두지 않는다.
 *
 * 로컬 편의를 위한 기본값(local-dev-salt)은 application.yml 의 플레이스홀더
 * ({@code ${APP_BLOG_COMMENT_IP_SALT:local-dev-salt}}) 에만 있다. application-prod.yml 은
 * 같은 플레이스홀더를 기본값 없이 선언하므로(APP_JWT_SECRET 과 동일한 방식), 운영에서
 * 환경변수가 비어 있으면 기동 시점에 바로 실패한다. 여기서 blank 를 조용히 치환하면
 * 그 실패를 가려버리므로 일부러 두지 않는다.
 */
@ConfigurationProperties(prefix = "app.blog-comment")
public record BlogCommentProperties(String ipSalt) {
}
