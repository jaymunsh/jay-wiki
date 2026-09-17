package cloud.leneu.jaywiki.kafka;

public record KafkaDemoOrderEvent(
        String orderId,
        String productCode,
        int quantity,
        KafkaDemoFailMode failMode
) {
}
