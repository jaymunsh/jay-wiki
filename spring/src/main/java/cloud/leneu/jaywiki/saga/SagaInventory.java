package cloud.leneu.jaywiki.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_saga_inventory")
@Getter
@Setter
public class SagaInventory {
    @Id
    private String productCode;
    private int available;
    private int reserved;
    private OffsetDateTime updatedAt;
}
