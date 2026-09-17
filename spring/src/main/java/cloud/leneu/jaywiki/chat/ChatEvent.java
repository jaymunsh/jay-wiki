package cloud.leneu.jaywiki.chat;

public record ChatEvent(
        String type,
        String userId,
        String nickname,
        String text,
        long at
) {
}
