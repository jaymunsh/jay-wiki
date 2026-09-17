package cloud.leneu.jaywiki.board;

import cloud.leneu.jaywiki.common.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 로그인이 없는 POST 를 IP 단위로 제한한다.
 *
 * 처음에는 익명 게시판만 막았는데, 같은 조건(인증 없음 + 쓰기)인 데모 실행과 로그인 시도가
 * 무제한으로 남아 있었다. 어디에 거는지는 {@link BoardWebConfig} 의 경로 목록 하나로만 정한다.
 */
@Component
public class BoardRateLimitInterceptor implements HandlerInterceptor {

    private static final String PROBLEM_JSON = """
            {"type":"https://jaywiki/errors/rate-limit","title":"Too Many Requests","status":429,"detail":"요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}
            """;

    private final BoardRateLimitProperties properties;
    private final StringRedisTemplate redis;

    public BoardRateLimitInterceptor(BoardRateLimitProperties properties,
            @Qualifier("securityRedisTemplate") StringRedisTemplate redis) {
        this.properties = properties;
        this.redis = redis;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!shouldLimit(request)) {
            return true;
        }

        String key = "board:write:rate:" + bucket(request) + ":" + ClientIpResolver.resolve(request);
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redis.expire(key, properties.getWindow());
        }
        if (count != null && count > properties.getCapacity()) {
            response.setStatus(429);
            response.setHeader(HttpHeaders.CONTENT_TYPE, "application/problem+json");
            response.getWriter().write(PROBLEM_JSON);
            return false;
        }
        return true;
    }

    private boolean shouldLimit(HttpServletRequest request) {
        // 경로 판단을 여기서 또 하지 않는다. 등록된 경로만 이 인터셉터를 탄다.
        return properties.isEnabled() && HttpMethod.POST.matches(request.getMethod());
    }

    /**
     * 기능별로 통을 나눈다. 하나로 합치면 데모를 눌러 본 사람이 로그인까지 막히고,
     * 반대로 로그인을 두드려 통을 비우면 게시판이 함께 잠긴다.
     * ponytail: 통마다 다른 상한이 필요해지면 그때 properties 를 통별로 쪼갠다.
     */
    private String bucket(HttpServletRequest request) {
        String[] segments = request.getRequestURI().split("/");
        return segments.length > 2 ? segments[2] : "etc";
    }
}
