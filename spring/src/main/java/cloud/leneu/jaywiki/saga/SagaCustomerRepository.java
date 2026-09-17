package cloud.leneu.jaywiki.saga;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SagaCustomerRepository extends JpaRepository<SagaCustomer, String> {
    List<SagaCustomer> findAllByOrderByNameAsc();
}
