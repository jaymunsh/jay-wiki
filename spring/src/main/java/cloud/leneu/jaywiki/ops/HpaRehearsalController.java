package cloud.leneu.jaywiki.ops;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HpaRehearsalController {
    private final HpaRehearsalService service;

    @GetMapping("/rehearsals/hpa")
    public HpaRehearsalView current(Authentication authentication) {
        return service.current(isAdmin(authentication));
    }

    @PostMapping("/admin/rehearsals/hpa")
    public HpaRehearsalView start(Authentication authentication,
                                 @RequestParam(defaultValue = "8") int workers) {
        return service.start(isAdmin(authentication), workers);
    }

    @DeleteMapping("/admin/rehearsals/hpa")
    public HpaRehearsalView cancel(Authentication authentication) {
        return service.cancel(isAdmin(authentication));
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
