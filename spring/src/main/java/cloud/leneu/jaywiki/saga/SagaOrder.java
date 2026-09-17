package cloud.leneu.jaywiki.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_saga_order")
@Getter
@Setter
public class SagaOrder {
    @Id
    private String id;
    private String customerId;
    private String productCode;
    private int quantity;
    private String status;
    private String idempotencyKey;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
