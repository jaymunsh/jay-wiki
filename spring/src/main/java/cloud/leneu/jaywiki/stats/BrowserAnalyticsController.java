package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.common.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import java.util.List;
import java.util.Locale;

@RestController
@RequiredArgsConstructor
public class BrowserAnalyticsController {
    private final BrowserAnalyticsService analytics;
    private final StringRedisTemplate redis;

    @PostMapping("/api/analytics/events")
    public ResponseEntity<Void> event(@RequestBody BrowserAnalyticsService.Event event, HttpServletRequest request, Authentication auth) {
        String ua=request.getHeader("User-Agent");
        boolean admin=auth!=null && auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN"));
        if (admin || "1".equals(request.getHeader("DNT")) || "1".equals(request.getHeader("Sec-GPC")) || bot(ua)) return ResponseEntity.noContent().build();
        // Require browser origin even for anonymous requests; BrowserOriginFilter checks exact origin.
        if (request.getHeader("Origin")==null) return ResponseEntity.status(403).build();
        String host=request.getServerName();
        if ((host.startsWith("blog.") ? "blog" : "wiki") .equals(event.site()) == false) return ResponseEntity.badRequest().build();
        if ((event.referrer()!=null && event.referrer().length()>256) || (event.campaign()!=null && event.campaign().length()>122)) return ResponseEntity.badRequest().build();
        String key="analytics:rate:"+analytics.hash(ClientIpResolver.resolve(request));
        Long count=redis.execute(new DefaultRedisScript<>(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", Long.class), List.of(key));
        if (count==null || count>120) return ResponseEntity.status(429).build();
        analytics.record(event,ua);
        return ResponseEntity.noContent().build();
    }
    static boolean bot(String ua) {
        return ua==null || ua.isBlank() || ua.toLowerCase(Locale.ROOT).matches(".*(bot|crawler|spider|headless|curl|wget|python|node|preview|lighthouse).*");
    }
    @GetMapping("/api/admin/stats/report")
    public BrowserAnalyticsService.Report report(@RequestParam(defaultValue="blog") String site,@RequestParam(defaultValue="30") int days) {
        return analytics.report(site,days);
    }
}
