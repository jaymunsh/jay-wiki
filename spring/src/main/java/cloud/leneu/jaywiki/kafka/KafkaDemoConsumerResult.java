package cloud.leneu.jaywiki.kafka;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_kafka_demo_consumer_result")
@Getter
@Setter
public class KafkaDemoConsumerResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String orderId;
    private String consumerName;
    private String status;
    private int attemptCount;
    private String lastError;
    private OffsetDateTime updatedAt;
}
