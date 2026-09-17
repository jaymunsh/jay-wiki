package cloud.leneu.jaywiki.auth;

import cloud.leneu.jaywiki.account.AccountUser;
import cloud.leneu.jaywiki.account.AccountUserRepository;
import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.stats.EntrySourceCookie;
import cloud.leneu.jaywiki.stats.Referrer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 계정 인증 API.
 *  POST /api/auth/register {username, password, nickname} → USER 생성 + httpOnly 쿠키(jw_token)
 *  POST /api/auth/login    {username, password} → USER 전용 로그인
 *  POST /api/auth/admin-login {username, password, otp} → ADMIN 전용 로그인
 *  POST /api/auth/logout  → 쿠키 삭제
 *  GET  /api/auth/me      → 현재 로그인 상태 {authenticated, username, role}
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AccountUserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final JwtCookieFactory cookies;
    private final AdminTotpService adminTotp;
    private final TokenRevocations revocations;

    public record LoginRequest(@NotBlank String username, @NotBlank String password, String otp) {}
    public record RegisterRequest(@NotBlank String username, @NotBlank String password, String nickname) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req,
                                     HttpServletRequest httpReq, HttpServletResponse res) {
        String username = normalizeUsername(req.username());
        if (username.length() < 3 || username.length() > 30 || !username.matches("[a-zA-Z0-9_.-]+")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "아이디는 3~30자의 영문, 숫자, _, ., - 만 사용할 수 있습니다."));
        }
        if (req.password() == null || req.password().length() < 8) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "비밀번호는 8자 이상이어야 합니다."));
        }
        if (users.findByUsername(username).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "이미 사용 중인 아이디입니다."));
        }

        AccountUser user = new AccountUser();
        user.setUsername(username);
        user.setPassword(encoder.encode(req.password()));
        user.setNickname(displayName(req.nickname(), username));
        user.setRole("USER");
        user.setProvider("local");
        // 방문 첫 순간의 유입 호스트를 담아 둔 세션 쿠키에서 꺼낸다. 가입 요청의 Referer 는
        // 로그인 화면 자신이라 그 시점엔 애초 어디서 왔는지가 이미 사라져 있다.
        user.setSource(Referrer.ofHost(EntrySourceCookie.read(httpReq)).source());
        user.setCreatedAt(OffsetDateTime.now());
        users.save(user);

        return issueLoginCookie(user, res);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletResponse res) {
        AccountUser u = users.findByUsername(normalizeUsername(req.username())).orElse(null);
        if (u == null || u.getPassword() == null || !encoder.matches(req.password(), u.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }
        if (!"USER".equals(u.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "관리자 사이트에서 로그인하세요.", "code", "ADMIN_LOGIN_REQUIRED"));
        }
        return issueLoginCookie(u, res);
    }

    @PostMapping("/admin-login")
    public ResponseEntity<?> adminLogin(@RequestBody LoginRequest req, HttpServletRequest request,
                                        HttpServletResponse res) {
        AccountUser u = users.findByUsername(normalizeUsername(req.username())).orElse(null);
        if (u == null || !"ADMIN".equals(u.getRole()) || u.getPassword() == null
                || !encoder.matches(req.password(), u.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "관리자 인증 정보가 올바르지 않습니다."));
        }
        AdminTotpService.Result result = adminTotp.verify(req.otp(), ClientIpResolver.resolve(request));
        if (result == AdminTotpService.Result.MISSING) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "관리자 OTP를 입력하세요.", "code", "OTP_REQUIRED"));
        }
        if (result == AdminTotpService.Result.BLOCKED) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "OTP 확인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.", "code", "OTP_BLOCKED"));
        }
        if (result != AdminTotpService.Result.VALID && result != AdminTotpService.Result.DISABLED) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "관리자 인증에 실패했습니다.", "code", "OTP_INVALID"));
        }
        return issueLoginCookie(u, res);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest req, HttpServletResponse res) {
        String token = JwtCookieFilter.extract(req);
        if (token != null) {
            var claims = jwt.parse(token);
            if (claims != null) revocations.revoke(token, claims);
        }
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        res.addHeader("Set-Cookie", cookies.create("", 0).toString());
        res.addHeader("Set-Cookie", cookies.delete("JSESSIONID").toString());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return ResponseEntity.ok(Map.of(
                    "authenticated", false,
                    "adminTotpEnabled", adminTotp.enabled()));
        }
        String role = auth.getAuthorities().stream().findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", "")).orElse("USER");
        AccountUser user = users.findByUsername(auth.getName()).orElse(null);
        String displayName = user == null || user.getNickname() == null || user.getNickname().isBlank()
                ? auth.getName()
                : user.getNickname();
        String provider = user == null ? "unknown" : user.getProvider();
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "username", auth.getName(),
                "displayName", displayName,
                "role", role,
                "provider", provider,
                "adminTotpEnabled", adminTotp.enabled()));
    }

    private ResponseEntity<?> issueLoginCookie(AccountUser user, HttpServletResponse response) {
        String token = jwt.issue(user.getUsername(), user.getRole());
        response.addHeader("Set-Cookie", cookies.create(token, jwt.getExpSeconds(user.getRole())).toString());
        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "displayName", displayName(user.getNickname(), user.getUsername()),
                "role", user.getRole(),
                "provider", user.getProvider()));
    }

    private static String normalizeUsername(String username) {
        return username == null ? "" : username.strip();
    }

    private static String displayName(String nickname, String username) {
        if (nickname == null || nickname.isBlank()) {
            return username;
        }
        String stripped = nickname.strip();
        return stripped.length() <= 30 ? stripped : stripped.substring(0, 30);
    }
}
