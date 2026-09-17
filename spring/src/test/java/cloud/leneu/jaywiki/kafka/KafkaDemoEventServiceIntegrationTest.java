package cloud.leneu.jaywiki.kafka;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import io.micrometer.core.instrument.MeterRegistry;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {"app.opensearch.enabled=false", "app.kafka-demo.enabled=false"})
@Import(KafkaDemoEventServiceIntegrationTest.Containers.class)
class KafkaDemoEventServiceIntegrationTest {
    @Autowired
    KafkaDemoEventService eventService;

    @Autowired
    KafkaDemoOrderRepository orderRepo;

    @Autowired
    MeterRegistry meterRegistry;

    @Test
    void publish마킹은_완료된_주문을_published로_되돌리지_않는다() {
        KafkaDemoOrder order = saveOrder("COMPLETED");

        eventService.markPublished(order.getId());

        assertThat(orderRepo.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void 필수_consumer가_모두_성공하면_주문을_completed로_마킹한다() {
        KafkaDemoOrder order = saveOrder("PUBLISHED");

        eventService.recordSuccess(order.getId(), KafkaDemoConsumerName.INVENTORY, "INVENTORY_CONSUMED", "ok");
        eventService.recordSuccess(order.getId(), KafkaDemoConsumerName.NOTIFICATION, "NOTIFICATION_CONSUMED", "ok");
        eventService.recordSuccess(order.getId(), KafkaDemoConsumerName.ANALYTICS, "ANALYTICS_CONSUMED", "ok");

        assertThat(orderRepo.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("COMPLETED");
        assertThat(meterRegistry.counter("jaywiki.kafka.consumer.events",
                "consumer", KafkaDemoConsumerName.ANALYTICS,
                "status", "SUCCESS").count()).isGreaterThanOrEqualTo(1.0);
    }

    @Test
    void dlq기록은_consumer_dlq_metric을_증가시킨다() {
        KafkaDemoOrder order = saveOrder("PUBLISHED");

        eventService.recordDlq(order.getId(), KafkaDemoConsumerName.NOTIFICATION, "dlq");

        assertThat(orderRepo.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("FAILED");
        assertThat(meterRegistry.counter("jaywiki.kafka.consumer.events",
                "consumer", KafkaDemoConsumerName.NOTIFICATION,
                "status", "DLQ").count()).isGreaterThanOrEqualTo(1.0);
    }

    private KafkaDemoOrder saveOrder(String status) {
        OffsetDateTime now = OffsetDateTime.now();
        KafkaDemoOrder order = new KafkaDemoOrder();
        order.setId("test_" + now.toInstant().toEpochMilli() + "_" + status.toLowerCase());
        order.setProductCode("JAY-HOODIE");
        order.setQuantity(1);
        order.setFailMode(KafkaDemoFailMode.NONE.name());
        order.setStatus(status);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return orderRepo.save(order);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Containers {
        @Bean
        @ServiceConnection
        PostgreSQLContainer<?> postgresContainer() {
            return new PostgreSQLContainer<>(DockerImageName.parse("postgres:latest"));
        }

        @Bean
        @ServiceConnection(name = "redis")
        GenericContainer<?> redisContainer() {
            return new GenericContainer<>(DockerImageName.parse("redis:latest")).withExposedPorts(6379);
        }
    }
}
