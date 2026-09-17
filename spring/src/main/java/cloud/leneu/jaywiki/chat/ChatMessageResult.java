package cloud.leneu.jaywiki.chat;

public record ChatMessageResult(
        ChatEvent event,
        boolean broadcast
) {
    public static ChatMessageResult broadcast(ChatEvent event) {
        return new ChatMessageResult(event, true);
    }

    public static ChatMessageResult privateError(ChatEvent event) {
        return new ChatMessageResult(event, false);
    }
}
