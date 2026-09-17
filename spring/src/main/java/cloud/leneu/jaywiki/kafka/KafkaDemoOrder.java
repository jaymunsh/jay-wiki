package cloud.leneu.jaywiki.kafka;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_kafka_demo_order")
@Getter
@Setter
public class KafkaDemoOrder {
    @Id
    private String id;
    private String productCode;
    private int quantity;
    private String failMode;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
