package cloud.leneu.jaywiki.chat;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "app.chat")
public record ChatProperties(
        int roomCapacity,
        Duration heartbeatTtl,
        int messageRateLimit,
        Duration messageRateWindow,
        List<String> allowedOriginPatterns
) {
    public ChatProperties {
        if (roomCapacity <= 0) {
            roomCapacity = 3;
        }
        if (heartbeatTtl == null) {
            heartbeatTtl = Duration.ofSeconds(30);
        }
        if (messageRateLimit <= 0) {
            messageRateLimit = 30;
        }
        if (messageRateWindow == null) {
            messageRateWindow = Duration.ofMinutes(1);
        }
        if (allowedOriginPatterns == null || allowedOriginPatterns.isEmpty()) {
            allowedOriginPatterns = List.of("https://portfolio.leneu.cloud", "http://localhost:*");
        }
    }
}
