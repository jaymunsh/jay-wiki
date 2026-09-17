package cloud.leneu.jaywiki.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_saga_step")
@Getter
@Setter
public class SagaStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String sagaId;
    private String stepName;
    private String status;
    private boolean compensating;
    private String message;
    private OffsetDateTime createdAt;
    /** 이 단계를 처리한 실물. service@pod 형식이고, 알 수 없으면 null 이다. */
    private String actor;
}
