package cloud.leneu.jaywiki.kafka;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.kafka-demo")
public record KafkaDemoProperties(
        boolean enabled,
        String orderTopic,
        String dlqTopic,
        String groupPrefix,
        Duration relayDelay,
        long maxRetries
) {
}
