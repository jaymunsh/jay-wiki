package cloud.leneu.jaywiki.ops;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.session.MapSessionRepository;
import org.springframework.session.SessionRepository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

class SessionDemoControllerTest {

    private SessionDemoController controller(Optional<SessionRepository<?>> repo) {
        return new SessionDemoController(repo);
    }

    @Test
    void 같은_세션이면_방문_수가_이어지고_첫_파드가_기억된다() {
        SessionDemoController controller = controller(Optional.empty());
        MockHttpSession session = new MockHttpSession();

        Map<String, Object> first = controller.visit(session);
        Map<String, Object> second = controller.visit(session);

        assertThat(first.get("hits")).isEqualTo(1);
        assertThat(second.get("hits")).isEqualTo(2);
        assertThat(second.get("firstPod")).isEqualTo(first.get("firstPod"));
        assertThat(second.get("samePod")).isEqualTo(true);
    }

    @Test
    void 세션이_바뀌면_방문_수가_처음부터_다시_센다() {
        SessionDemoController controller = controller(Optional.empty());

        Map<String, Object> first = controller.visit(new MockHttpSession());
        Map<String, Object> other = controller.visit(new MockHttpSession());

        assertThat(first.get("hits")).isEqualTo(1);
        assertThat(other.get("hits")).isEqualTo(1);
    }

    @Test
    void 저장소는_설정이_아니라_주입된_빈으로_판정한다() {
        // 세션 저장소가 없으면 톰캣이 파드 메모리에 들고 있다는 뜻이다.
        assertThat(controller(Optional.empty()).visit(new MockHttpSession()).get("store"))
                .isEqualTo("pod-memory");

        // Spring Session 이 붙어 있으면 그 구현 이름으로 답한다.
        SessionRepository<?> map = new MapSessionRepository(new ConcurrentHashMap<>());
        assertThat(controller(Optional.of(map)).visit(new MockHttpSession()).get("store"))
                .isEqualTo("MapSessionRepository");
    }
}
