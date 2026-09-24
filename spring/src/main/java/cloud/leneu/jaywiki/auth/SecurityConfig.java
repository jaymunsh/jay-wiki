package cloud.leneu.jaywiki.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 가벼운 관리자 인증.
 *  - 공개 콘텐츠 조회는 자유, 관리자·문서 이력 조회는 ROLE_ADMIN 필요
 *  - 변경(POST/PUT/DELETE) 는 ROLE_ADMIN 필요 → 글쓰기/삭제/탭관리 보호
 *  - 로그인/헬스 등은 공개
 *  - 세션 안 씀(STATELESS) + JWT 쿠키 필터로 인증
 *  - prod 에선 Cloudflare Access 가 앞단에서 한 번 더 감쌈(이중 방어)
 */
@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtCookieFilter jwtCookieFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // BrowserOriginFilter enforces Origin/Fetch Metadata; cookie scripts need a non-simple header.
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})                       // 동일 오리진(BFF) 이라 기본
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/ws/**").permitAll()
                // 아래의 GET /api/** 공개 규칙보다 먼저 와야 한다.
                // 뒤에 두면 관리 목록이 인증 없이 읽혀 미발행(draft) 글이 공개된다.
                // blog 만 막아 두었더니 /api/admin/services 의 GET 이 열려 클러스터 구성이
                // 인증 없이 읽혔다. 경로마다 예외를 더하는 대신 admin 전체를 닫는다.
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/articles/*/revisions/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/analytics/events").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/**").permitAll()   // 조회 공개
                .requestMatchers(HttpMethod.POST, "/api/board/**").permitAll() // 익명 게시판(작성/댓글/본인삭제)
                .requestMatchers(HttpMethod.POST, "/api/blog/posts/*/comments").permitAll() // 익명 블로그 댓글 작성
                .requestMatchers(HttpMethod.POST, "/api/blog/comments/*/delete").permitAll() // 익명 블로그 댓글 본인삭제
                .requestMatchers(HttpMethod.POST, "/api/game/*/scores").permitAll() // 익명 게임 기록 등록
                .requestMatchers(HttpMethod.POST, "/api/saga/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/chat/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/kafka/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/domain-scenarios/spreadsheet-operations/exports").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/domain-scenarios/**").permitAll()
                .requestMatchers("/api/**").hasRole("ADMIN")              // 그 외 변경(위키/탭/게시판 DELETE)은 ADMIN
                .anyRequest().permitAll())
            .addFilterBefore(jwtCookieFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new BrowserOriginFilter(), JwtCookieFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }
}
