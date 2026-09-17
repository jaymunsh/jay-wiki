package cloud.leneu.jaywiki.saga;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentProjectionRepository extends JpaRepository<PaymentProjection, String> {
}
