package cloud.leneu.jaywiki.ops;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 조회는 공개, 실행은 ADMIN. HPA 리허설과 같은 경계다 —
 * 방문자는 무엇이 어떻게 도는지 보고, 실제로 돌리는 것은 관리자만 한다.
 *
 * 실행 경로가 /api/admin/** 아래라 인가는 SecurityConfig 가 이미 걸어 뒀고,
 * 덤으로 403 드릴이 성립한다. JaywikiAdminForbiddenSustained 규칙이
 * uri=~"/api/admin.*" 를 보는데 이 경로가 거기에 든다.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AlertDrillController {
    private final AlertDrillService service;

    @GetMapping("/alert-drills")
    public AlertDrillView current(Authentication authentication) {
        return service.view(isAdmin(authentication));
    }

    /**
     * kind 를 enum 으로 바로 받지 않는다. 오타가 들어오면 형 변환 실패가 전역 핸들러의
     * 마지막 갈래로 떨어져 500 이 되고, 그러면 오타 하나가 진짜 알림을 울린다.
     */
    @PostMapping("/admin/alert-drills/{kind}")
    public AlertDrillView run(@PathVariable String kind, Authentication authentication) {
        return service.run(AlertDrillKind.parse(kind), isAdmin(authentication));
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
