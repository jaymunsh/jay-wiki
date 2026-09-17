package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.saga.SagaInventory;
import cloud.leneu.jaywiki.saga.SagaInventoryReplenisher;
import cloud.leneu.jaywiki.saga.SagaInventoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {"app.opensearch.enabled=false"})
@Import(TestcontainersConfiguration.class)
class SagaInventoryReplenisherTest {

    @Autowired
    SagaInventoryReplenisher replenisher;

    @Autowired
    SagaInventoryRepository inventoryRepo;

    /**
     * 임계 밑만 채우고 reserved 는 건드리지 않는다. 통째로 덮으면 진행 중인 사가의 예약이
     * 사라져서, 보상이 이미 푼 재고를 한 번 더 푼다.
     */
    @Test
    void refillsOnlyBelowLowWaterAndKeepsReserved() {
        inventoryRepo.save(item("TEST-LOW", 3, 2));
        inventoryRepo.save(item("TEST-ENOUGH", 50, 1));

        replenisher.replenish();

        SagaInventory low = inventoryRepo.findById("TEST-LOW").orElseThrow();
        assertThat(low.getAvailable()).isEqualTo(100);
        assertThat(low.getReserved()).isEqualTo(2);

        SagaInventory enough = inventoryRepo.findById("TEST-ENOUGH").orElseThrow();
        assertThat(enough.getAvailable()).isEqualTo(50);
    }

    private SagaInventory item(String code, int available, int reserved) {
        SagaInventory inventory = new SagaInventory();
        inventory.setProductCode(code);
        inventory.setAvailable(available);
        inventory.setReserved(reserved);
        inventory.setUpdatedAt(OffsetDateTime.now());
        return inventory;
    }
}
