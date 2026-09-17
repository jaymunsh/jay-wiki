package cloud.leneu.jaywiki.saga;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SagaOrderRepository extends JpaRepository<SagaOrder, String> {
    Optional<SagaOrder> findByIdempotencyKey(String idempotencyKey);
}
