package cloud.leneu.jaywiki.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@EnableScheduling
@RequiredArgsConstructor
@EnableConfigurationProperties(ChatProperties.class)
public class ChatConfig implements WebSocketConfigurer {
    private final ChatRoomService roomService;
    private final ObjectMapper objectMapper;
    private final ChatProperties properties;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // "*" 면 아무 사이트나 방문자 브라우저로 이 소켓을 연다. 공개 오리진과 로컬만 허용한다.
        registry.addHandler(new ChatWebSocketHandler(roomService, objectMapper), "/ws/chat")
                .setAllowedOriginPatterns(properties.allowedOriginPatterns().toArray(String[]::new));
    }
}
