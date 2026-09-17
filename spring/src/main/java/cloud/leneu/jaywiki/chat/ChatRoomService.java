package cloud.leneu.jaywiki.chat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ChatRoomService {
    private static final String ROOM = "main";
    private static final String MEMBERS = "chat:room:main:members";
    private static final String QUEUE = "chat:room:main:queue";
    private static final String PROFILES = "chat:room:main:profiles";
    private static final String EVENTS = "chat:room:main:events";
    private static final String CHANNEL = "chat:room:main:broadcast";

    /**
     * 정원 확인과 입장을 한 스크립트로 묶는다.
     *
     * 예전에는 자바 synchronized 로 감쌌는데, 그건 JVM 하나 안에서만 유효한 잠금이다.
     * 상태는 Redis 에 공유되지만 잠금은 공유되지 않으므로, replica 가 둘이면 두 인스턴스가
     * 각각 SCARD 로 같은 인원수를 읽고 둘 다 "자리 있음"으로 판단해 정원을 넘긴다.
     * Redis 는 명령을 단일 스레드로 처리하고 Lua 스크립트를 원자적으로 실행하므로,
     * 확인과 추가 사이에 다른 요청이 끼어들 수 없다.
     */
    private static final RedisScript<String> JOIN_SCRIPT = new DefaultRedisScript<>("""
            redis.call('SREM', KEYS[1], ARGV[1])
            redis.call('ZREM', KEYS[2], ARGV[1])
            if redis.call('SCARD', KEYS[1]) < tonumber(ARGV[2]) then
              redis.call('SADD', KEYS[1], ARGV[1])
              return 'E'
            end
            redis.call('ZADD', KEYS[2], tonumber(ARGV[3]), ARGV[1])
            return 'W:' .. tostring(redis.call('ZRANK', KEYS[2], ARGV[1]) + 1)
            """, String.class);

    /** 퇴장도 두 자료구조를 함께 건드리므로 원자적으로 처리한다. 반환값은 참가자였는지 여부다. */
    private static final RedisScript<Long> LEAVE_SCRIPT = new DefaultRedisScript<>("""
            local removed = redis.call('SREM', KEYS[1], ARGV[1])
            redis.call('ZREM', KEYS[2], ARGV[1])
            return removed
            """, Long.class);

    /** 자리가 빈 만큼 대기열 앞에서 끌어올린다. 승급된 userId 목록을 순서대로 돌려준다. */
    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> PROMOTE_SCRIPT = new DefaultRedisScript<>("""
            local promoted = {}
            while redis.call('SCARD', KEYS[1]) < tonumber(ARGV[1]) do
              local head = redis.call('ZRANGE', KEYS[2], 0, 0)
              if #head == 0 then break end
              redis.call('ZREM', KEYS[2], head[1])
              redis.call('SADD', KEYS[1], head[1])
              table.insert(promoted, head[1])
            end
            return promoted
            """, List.class);

    private final ChatProperties properties;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public ChatRoomService(ChatProperties properties, StringRedisTemplate redis, ObjectMapper objectMapper,
                           MeterRegistry meterRegistry) {
        this.properties = properties;
        this.redis = redis;
        this.objectMapper = objectMapper;
        Gauge.builder("jaywiki.chat.members", this, service -> service.state().memberCount())
                .register(meterRegistry);
        Gauge.builder("jaywiki.chat.queue", this, service -> service.state().queueCount())
                .register(meterRegistry);
    }

    public ChatJoinResult join(String userId, String nickname, boolean virtual) {
        String safeName = safeNickname(nickname);
        saveProfile(userId, safeName, virtual);
        heartbeat(userId);

        String result = redis.execute(JOIN_SCRIPT, List.of(MEMBERS, QUEUE),
                userId, Integer.toString(properties.roomCapacity()), Long.toString(now()));
        if ("E".equals(result)) {
            event("ENTERED", userId, safeName, null);
            return new ChatJoinResult(userId, safeName, "ENTERED", 0);
        }
        int position = Integer.parseInt(String.valueOf(result).substring(2));
        event("WAITING", userId, safeName, "대기 " + position + "번");
        return new ChatJoinResult(userId, safeName, "WAITING", position);
    }

    public void leave(String userId) {
        String nickname = nickname(userId);
        Long removed = redis.execute(LEAVE_SCRIPT, List.of(MEMBERS, QUEUE), userId);
        clearUserKeys(userId);
        if (removed != null && removed > 0) {
            event("LEFT", userId, nickname, null);
            promote();
        }
    }

    public void heartbeat(String userId) {
        redis.opsForValue().set(heartbeatKey(userId), ROOM, properties.heartbeatTtl());
    }

    public ChatMessageResult message(String userId, String text) {
        if (!Boolean.TRUE.equals(redis.opsForSet().isMember(MEMBERS, userId))) {
            return privateError(userId, "입장 후 메시지를 보낼 수 있습니다.");
        }
        Long count = redis.opsForValue().increment(rateKey(userId));
        if (count != null && count == 1L) {
            redis.expire(rateKey(userId), properties.messageRateWindow());
        }
        if (count != null && count > properties.messageRateLimit()) {
            return privateError(userId, "메시지 속도가 너무 빠릅니다.");
        }
        return ChatMessageResult.broadcast(event("MESSAGE", userId, nickname(userId), text == null ? "" : text.strip()));
    }

    public ChatRoomState state() {
        List<ChatRoomState.Participant> members = members().stream()
                .sorted(Comparator.comparing(ChatRoomState.Participant::joinedAt))
                .toList();
        List<ChatRoomState.Participant> queue = queue();
        return new ChatRoomState(
                properties.roomCapacity(),
                members.size(),
                queue.size(),
                members,
                queue,
                events());
    }

    public List<ChatJoinResult> addVirtualUsers(int count) {
        return java.util.stream.IntStream.range(0, count)
                .mapToObj(index -> join("bot_" + UUID.randomUUID().toString().replace("-", ""),
                        "virtual-" + (index + 1), true))
                .toList();
    }

    public void removeVirtualUsers(int count) {
        List<String> candidates = java.util.stream.Stream.concat(members().stream(), queue().stream())
                .filter(ChatRoomState.Participant::virtual)
                .map(ChatRoomState.Participant::userId)
                .limit(count)
                .toList();
        candidates.forEach(this::leave);
    }

    /**
     * KEYS 는 전체 키 공간을 훑는 O(N) 명령이고, Redis 가 단일 스레드라 그동안 다른 요청이 전부 멈춘다.
     * SCAN 은 커서로 나눠 순회해서 다른 요청을 막지 않는다. 데모 데이터라 지금은 차이가 안 보이지만
     * 운영 습관으로 맞춰 둔다.
     */
    public void reset() {
        List<String> keys = new ArrayList<>();
        try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match("chat:*").count(200).build())) {
            cursor.forEachRemaining(keys::add);
        }
        if (!keys.isEmpty()) {
            redis.delete(keys);
        }
    }

    @Scheduled(fixedDelay = 10_000)
    public void cleanupStaleUsers() {
        List<String> stale = java.util.stream.Stream.concat(members().stream(), queue().stream())
                .filter(participant -> !participant.virtual())
                .filter(participant -> !Boolean.TRUE.equals(redis.hasKey(heartbeatKey(participant.userId()))))
                .map(ChatRoomState.Participant::userId)
                .toList();
        stale.forEach(this::leave);
    }

    private void promote() {
        @SuppressWarnings("rawtypes")
        List raw = redis.execute(PROMOTE_SCRIPT, List.of(MEMBERS, QUEUE),
                Integer.toString(properties.roomCapacity()));
        if (raw == null) {
            return;
        }
        for (Object promoted : raw) {
            String userId = String.valueOf(promoted);
            event("PROMOTED", userId, nickname(userId), null);
            event("ENTERED", userId, nickname(userId), null);
        }
    }

    private void clearUserKeys(String userId) {
        redis.delete(heartbeatKey(userId));
        redis.delete(rateKey(userId));
        redis.delete(profileKey(userId));
    }

    private long memberCount() {
        Long count = redis.opsForSet().size(MEMBERS);
        return count == null ? 0 : count;
    }

    private List<ChatRoomState.Participant> members() {
        Set<String> ids = redis.opsForSet().members(MEMBERS);
        if (ids == null) {
            return List.of();
        }
        return ids.stream().map(this::participant).toList();
    }

    private List<ChatRoomState.Participant> queue() {
        Set<String> ids = redis.opsForZSet().range(QUEUE, 0, -1);
        if (ids == null) {
            return List.of();
        }
        return ids.stream().map(this::participant).toList();
    }

    private ChatRoomState.Participant participant(String userId) {
        Map<Object, Object> raw = redis.opsForHash().entries(profileKey(userId));
        String nickname = String.valueOf(raw.getOrDefault("nickname", userId));
        boolean virtual = Boolean.parseBoolean(String.valueOf(raw.getOrDefault("virtual", "false")));
        long joinedAt = Long.parseLong(String.valueOf(raw.getOrDefault("joinedAt", "0")));
        return new ChatRoomState.Participant(userId, nickname, virtual, joinedAt);
    }

    private List<ChatEvent> events() {
        List<MapRecord<String, Object, Object>> records = redis.opsForStream().reverseRange(EVENTS,
                org.springframework.data.domain.Range.unbounded(),
                org.springframework.data.redis.connection.Limit.limit().count(30));
        if (records == null) {
            return List.of();
        }
        return records.reversed().stream()
                .map(record -> new ChatEvent(
                        String.valueOf(record.getValue().getOrDefault("type", "")),
                        String.valueOf(record.getValue().getOrDefault("userId", "")),
                        String.valueOf(record.getValue().getOrDefault("nickname", "")),
                        String.valueOf(record.getValue().getOrDefault("text", "")),
                        Long.parseLong(String.valueOf(record.getValue().getOrDefault("at", "0")))))
                .toList();
    }

    private ChatEvent event(String type, String userId, String nickname, String text) {
        ChatEvent event = new ChatEvent(type, userId, nickname, text == null ? "" : text, now());
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("type", event.type());
        fields.put("userId", event.userId());
        fields.put("nickname", event.nickname());
        fields.put("text", event.text());
        fields.put("at", Long.toString(event.at()));
        redis.opsForStream().add(EVENTS, fields);
        redis.opsForStream().trim(EVENTS, 200);
        redis.convertAndSend(CHANNEL, writeEvent(event));
        return event;
    }

    private ChatMessageResult privateError(String userId, String text) {
        return ChatMessageResult.privateError(new ChatEvent("ERROR", userId, nickname(userId), text, now()));
    }

    private String writeEvent(ChatEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("chat event serialization failed", e);
        }
    }

    private void saveProfile(String userId, String nickname, boolean virtual) {
        Map<String, String> profile = Map.of(
                "nickname", nickname,
                "virtual", Boolean.toString(virtual),
                "joinedAt", Long.toString(now()));
        redis.opsForHash().putAll(profileKey(userId), profile);
    }

    private String nickname(String userId) {
        Object value = redis.opsForHash().get(profileKey(userId), "nickname");
        return value == null ? userId : value.toString();
    }

    private String safeNickname(String nickname) {
        if (nickname == null || nickname.isBlank()) {
            return "guest";
        }
        return nickname.strip().length() > 24 ? nickname.strip().substring(0, 24) : nickname.strip();
    }

    private String profileKey(String userId) {
        return PROFILES + ":" + userId;
    }

    private String heartbeatKey(String userId) {
        return "chat:user:" + userId + ":heartbeat";
    }

    private String rateKey(String userId) {
        return "chat:rate:" + userId;
    }

    private long now() {
        return Instant.now().toEpochMilli();
    }
}
