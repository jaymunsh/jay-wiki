package cloud.leneu.jaywiki.chat;

import java.util.List;

public record ChatRoomState(
        int capacity,
        int memberCount,
        int queueCount,
        List<Participant> members,
        List<Participant> queue,
        List<ChatEvent> events
) {
    public record Participant(String userId, String nickname, boolean virtual, long joinedAt) {
    }
}
