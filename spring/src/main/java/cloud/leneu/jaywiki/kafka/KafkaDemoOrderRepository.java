package cloud.leneu.jaywiki.kafka;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface KafkaDemoOrderRepository extends JpaRepository<KafkaDemoOrder, String> {
    List<KafkaDemoOrder> findTop20ByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from KafkaDemoOrder o where o.id = :id")
    Optional<KafkaDemoOrder> findByIdForUpdate(@Param("id") String id);
}
