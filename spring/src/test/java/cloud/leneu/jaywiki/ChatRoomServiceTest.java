package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.chat.ChatJoinResult;
import cloud.leneu.jaywiki.chat.ChatMessageResult;
import cloud.leneu.jaywiki.chat.ChatRoomService;
import cloud.leneu.jaywiki.chat.ChatRoomState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
                "app.opensearch.enabled=false",
        "app.chat.room-capacity=3"
})
@Import(TestcontainersConfiguration.class)
class ChatRoomServiceTest {

    @Autowired
    ChatRoomService service;

    @Autowired
    StringRedisTemplate redis;

    @BeforeEach
    void resetRoom() {
        service.reset();
    }

    @Test
    void 네번째_사용자는_대기열에_들어간다() {
        service.join("u1", "user-1", false);
        service.join("u2", "user-2", false);
        service.join("u3", "user-3", false);

        ChatJoinResult result = service.join("u4", "user-4", false);
        ChatRoomState state = service.state();

        assertThat(result.status()).isEqualTo("WAITING");
        assertThat(result.position()).isEqualTo(1);
        assertThat(state.capacity()).isEqualTo(3);
        assertThat(state.memberCount()).isEqualTo(3);
        assertThat(state.queueCount()).isEqualTo(1);
        assertThat(state.queue()).extracting(ChatRoomState.Participant::userId).containsExactly("u4");
    }

    @Test
    void 입장자가_나가면_대기열_첫번째가_승격된다() {
        service.join("u1", "user-1", false);
        service.join("u2", "user-2", false);
        service.join("u3", "user-3", false);
        service.join("u4", "user-4", false);
        service.join("u5", "user-5", false);

        service.leave("u2");
        ChatRoomState state = service.state();

        assertThat(state.members()).extracting(ChatRoomState.Participant::userId)
                .containsExactlyInAnyOrder("u1", "u3", "u4");
        assertThat(state.queue()).extracting(ChatRoomState.Participant::userId).containsExactly("u5");
        assertThat(state.memberCount()).isEqualTo(3);
        assertThat(state.queueCount()).isEqualTo(1);
    }

    @Test
    void 대기열_사용자_메시지_오류는_전체_이벤트에_저장하지_않는다() {
        service.join("u1", "user-1", false);
        service.join("u2", "user-2", false);
        service.join("u3", "user-3", false);
        service.join("u4", "user-4", false);

        ChatMessageResult result = service.message("u4", "hello");
        ChatRoomState state = service.state();

        assertThat(result.broadcast()).isFalse();
        assertThat(result.event().type()).isEqualTo("ERROR");
        assertThat(result.event().text()).isEqualTo("입장 후 메시지를 보낼 수 있습니다.");
        assertThat(state.events()).extracting(event -> event.text())
                .doesNotContain("입장 후 메시지를 보낼 수 있습니다.");
    }

    @Test
    void 리셋은_채팅_키를_초기화한다() {
        service.join("u1", "user-1", false);
        service.join("u2", "user-2", false);

        service.reset();

        assertThat(service.state().memberCount()).isZero();
        assertThat(service.state().queueCount()).isZero();
        assertThat(redis.keys("chat:*")).isEmpty();
    }
}
