package cloud.leneu.jaywiki.kafka;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class KafkaDemoMetrics {
    private final MeterRegistry meterRegistry;

    public KafkaDemoMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void orderCreated(KafkaDemoFailMode failMode) {
        meterRegistry.counter("jaywiki.kafka.orders",
                "status", "ACCEPTED",
                "fail_mode", failMode.name()).increment();
    }

    public void outboxPublished() {
        meterRegistry.counter("jaywiki.kafka.outbox.events",
                "status", "PUBLISHED").increment();
    }

    public void outboxPublishFailed() {
        meterRegistry.counter("jaywiki.kafka.outbox.events",
                "status", "FAILED").increment();
    }

    public void consumerAttempt(String consumerName) {
        meterRegistry.counter("jaywiki.kafka.consumer.attempts",
                "consumer", consumerName).increment();
    }

    public void consumerSuccess(String consumerName) {
        meterRegistry.counter("jaywiki.kafka.consumer.events",
                "consumer", consumerName,
                "status", "SUCCESS").increment();
    }

    public void consumerRetry(String consumerName) {
        meterRegistry.counter("jaywiki.kafka.consumer.events",
                "consumer", consumerName,
                "status", "RETRY").increment();
    }

    public void consumerDlq(String consumerName) {
        meterRegistry.counter("jaywiki.kafka.consumer.events",
                "consumer", consumerName,
                "status", "DLQ").increment();
    }

    public long start() {
        return System.nanoTime();
    }

    public void consumerProcessing(String consumerName, String status, long startedAtNanos) {
        Timer.builder("jaywiki.kafka.consumer.processing")
                .tag("consumer", consumerName)
                .tag("status", status)
                .register(meterRegistry)
                .record(System.nanoTime() - startedAtNanos, TimeUnit.NANOSECONDS);
    }
}
