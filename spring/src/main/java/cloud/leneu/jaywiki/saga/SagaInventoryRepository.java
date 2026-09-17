package cloud.leneu.jaywiki.saga;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SagaInventoryRepository extends JpaRepository<SagaInventory, String> {
}
