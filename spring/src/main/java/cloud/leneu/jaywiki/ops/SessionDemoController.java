package cloud.leneu.jaywiki.ops;

import jakarta.servlet.http.HttpSession;
import org.springframework.session.SessionRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 세션이 파드를 건너 살아남는지 눈으로 보게 하는 시연 엔드포인트.
 *
 * <p>이 프로젝트는 인증을 JWT 쿠키로 하고 세션을 안 만든다. 그래서 파드가 둘이 돼도
 * 세션이 깨지는 것을 볼 자리가 없었다. 이 엔드포인트만 일부러 세션을 만든다.
 *
 * <p>store 는 설정값이 아니라 <b>실제로 주입된 SessionRepository</b> 를 보고 정한다.
 * 처음에는 프로퍼티를 읽어 적었는데, 그 값이 거짓이었다 — spring-session-data-redis 를
 * 의존성에 넣은 것만으로 Boot 자동설정이 세션을 Redis 로 옮겼고, 화면은 계속
 * 「파드 메모리」라고 말했다. 무엇을 쓰는지는 설정이 아니라 빈에게 묻는다.
 */
@RestController
@RequestMapping("/api/session-demo")
public class SessionDemoController {

    private final String store;
    private final String pod;

    public SessionDemoController(Optional<SessionRepository<?>> sessionRepository) {
        this.store = sessionRepository
                .map(repo -> repo.getClass().getSimpleName().toLowerCase().contains("redis")
                        ? "redis"
                        : repo.getClass().getSimpleName())
                .orElse("pod-memory");
        String host = System.getenv("HOSTNAME");
        this.pod = host == null || host.isBlank() ? "local" : host;
    }

    @GetMapping
    public Map<String, Object> visit(HttpSession session) {
        Integer hits = (Integer) session.getAttribute("hits");
        hits = hits == null ? 1 : hits + 1;
        session.setAttribute("hits", hits);

        String firstPod = (String) session.getAttribute("firstPod");
        if (firstPod == null) {
            firstPod = pod;
            session.setAttribute("firstPod", firstPod);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("store", store);
        body.put("pod", pod);
        body.put("firstPod", firstPod);
        body.put("samePod", pod.equals(firstPod));
        body.put("hits", hits);
        body.put("sessionId", session.getId());
        return body;
    }
}
