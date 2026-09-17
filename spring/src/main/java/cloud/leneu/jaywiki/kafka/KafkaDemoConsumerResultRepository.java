package cloud.leneu.jaywiki.kafka;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KafkaDemoConsumerResultRepository extends JpaRepository<KafkaDemoConsumerResult, Long> {
    Optional<KafkaDemoConsumerResult> findByOrderIdAndConsumerName(String orderId, String consumerName);

    List<KafkaDemoConsumerResult> findByOrderIdOrderByConsumerNameAsc(String orderId);
}
