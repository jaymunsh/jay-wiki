package cloud.leneu.jaywiki.board;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class BoardWebConfig implements WebMvcConfigurer {

    private final BoardRateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 인증 없이 POST 할 수 있는 경로를 전부 건다. 여기 없는 경로는 제한도 없다.
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns(
                        "/api/board/**",
                        "/api/blog/**",
                        "/api/saga/**",
                        "/api/chat/**",
                        "/api/kafka/**",
                        "/api/domain-scenarios/**",
                        "/api/auth/login",
                        "/api/auth/register");
    }
}
