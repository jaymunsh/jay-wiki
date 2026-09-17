package cloud.leneu.jaywiki.auth;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * 요청의 httpOnly 쿠키(jw_token)에서 JWT 를 꺼내 SecurityContext 에 인증 심음.
 * 쿠키 없거나 무효면 그냥 통과(익명) → SecurityConfig 가 보호 경로에서 거른다.
 */
@Component
@RequiredArgsConstructor
public class JwtCookieFilter extends OncePerRequestFilter {

    public static final String COOKIE = "jw_token";
    private final JwtService jwt;
    private final TokenRevocations revocations;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = extract(req);
        if (token != null) {
            Claims c = jwt.parse(token);
            if (c != null) {
                try {
                    if (revocations.isRevoked(token)) c = null;
                } catch (RuntimeException unavailable) {
                    SecurityContextHolder.clearContext();
                    res.sendError(503, "Authentication state unavailable");
                    return;
                }
            }
            if (c != null) {
                String role = c.get("role", String.class);
                var auth = new UsernamePasswordAuthenticationToken(
                        c.getSubject(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + (role == null ? "USER" : role))));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(req, res);
    }

    static String extract(HttpServletRequest req) {
        if (req.getCookies() == null) return null;
        for (Cookie ck : req.getCookies()) {
            if (COOKIE.equals(ck.getName())) return ck.getValue();
        }
        return null;
    }
}
