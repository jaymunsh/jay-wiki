package cloud.leneu.jaywiki.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_saga_instance")
@Getter
@Setter
public class SagaInstance {
    @Id
    private String id;
    private String orderId;
    private String status;
    private String currentStep;
    private String failAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime completedAt;
}
