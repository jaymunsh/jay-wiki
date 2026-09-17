package cloud.leneu.jaywiki.kafka;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KafkaDemoEventLogRepository extends JpaRepository<KafkaDemoEventLog, Long> {
    List<KafkaDemoEventLog> findByOrderIdOrderByIdAsc(String orderId);
}
