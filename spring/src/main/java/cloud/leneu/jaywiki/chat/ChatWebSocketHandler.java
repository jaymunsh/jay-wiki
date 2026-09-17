package cloud.leneu.jaywiki.chat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class ChatWebSocketHandler extends TextWebSocketHandler {
    private static final String USER_ID = "userId";

    private final ChatRoomService roomService;
    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(ChatRoomService roomService, ObjectMapper objectMapper) {
        this.roomService = roomService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        Map<String, String> query = query(session.getUri());
        String userId = valueOrNew(query.get("userId"));
        String nickname = valueOrDefault(query.get("nickname"), "guest");
        // userId 는 브라우저가 보낸다. 재접속해도 대기열 자리를 잃지 않으려면 그래야 한다.
        // 다만 이 값이 화면 상태로 모두에게 방송되므로, 그대로 두면 남의 id 로 붙어 세션을
        // 덮어쓰고 상대를 끊어낼 수 있었다. 이미 붙어 있는 id 는 거절한다.
        if (sessions.putIfAbsent(userId, session) != null) {
            send(session, ChatSocketPayload.error("이미 연결된 사용자입니다."));
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        session.getAttributes().put(USER_ID, userId);

        ChatJoinResult self = roomService.join(userId, nickname, false);
        send(session, ChatSocketPayload.welcome(self, roomService.state()));
        broadcastState();
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String userId = sessionUserId(session);
        ChatMessage incoming = readMessage(message.getPayload());
        if (incoming == null) {
            send(session, ChatSocketPayload.error("메시지 형식이 올바르지 않습니다."));
            return;
        }

        switch (incoming.type()) {
            case "PING" -> {
                roomService.heartbeat(userId);
                send(session, ChatSocketPayload.state(roomService.state()));
            }
            case "MESSAGE" -> {
                ChatMessageResult result = roomService.message(userId, incoming.text());
                if (result.broadcast()) {
                    broadcast(ChatSocketPayload.event(result.event(), roomService.state()));
                } else {
                    send(session, ChatSocketPayload.error(result.event().text()));
                }
            }
            case "LEAVE" -> session.close(CloseStatus.NORMAL);
            default -> send(session, ChatSocketPayload.error("지원하지 않는 메시지 타입입니다."));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws IOException {
        // 거절된 연결은 USER_ID 가 없다. 남의 세션을 지우지 않도록 자기 것일 때만 지운다.
        Object attached = session.getAttributes().get(USER_ID);
        if (attached == null) {
            return;
        }
        String userId = attached.toString();
        sessions.remove(userId, session);
        roomService.leave(userId);
        broadcastState();
    }

    private ChatMessage readMessage(String payload) {
        try {
            return objectMapper.readValue(payload, ChatMessage.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private void broadcastState() throws IOException {
        broadcast(ChatSocketPayload.state(roomService.state()));
    }

    private void broadcast(ChatSocketPayload payload) throws IOException {
        for (WebSocketSession session : sessions.values()) {
            if (session.isOpen()) {
                send(session, payload);
            }
        }
    }

    private void send(WebSocketSession session, ChatSocketPayload payload) throws IOException {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
    }

    private String sessionUserId(WebSocketSession session) {
        Object value = session.getAttributes().get(USER_ID);
        return value == null ? valueOrNew(null) : value.toString();
    }

    private Map<String, String> query(URI uri) {
        if (uri == null) {
            return Map.of();
        }
        return UriComponentsBuilder.fromUri(uri).build().getQueryParams().toSingleValueMap();
    }

    private String valueOrNew(String value) {
        if (value == null || value.isBlank()) {
            return "guest_" + UUID.randomUUID().toString().replace("-", "");
        }
        return value.strip();
    }

    private String valueOrDefault(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.strip();
    }

    private record ChatSocketPayload(
            String type,
            ChatJoinResult self,
            ChatRoomState state,
            ChatEvent event,
            String message
    ) {
        private static ChatSocketPayload welcome(ChatJoinResult self, ChatRoomState state) {
            return new ChatSocketPayload("WELCOME", self, state, null, "");
        }

        private static ChatSocketPayload state(ChatRoomState state) {
            return new ChatSocketPayload("STATE", null, state, null, "");
        }

        private static ChatSocketPayload event(ChatEvent event, ChatRoomState state) {
            return new ChatSocketPayload("EVENT", null, state, event, "");
        }

        private static ChatSocketPayload error(String message) {
            return new ChatSocketPayload("ERROR", null, null, null, message);
        }
    }
}
