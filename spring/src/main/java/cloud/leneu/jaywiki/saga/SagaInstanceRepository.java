package cloud.leneu.jaywiki.saga;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface SagaInstanceRepository extends JpaRepository<SagaInstance, String> {
    Optional<SagaInstance> findByOrderId(String orderId);
    List<SagaInstance> findTop20ByOrderByCreatedAtDesc();

    /** 시작만 하고 끝나지 않은 사가. 호출 도중 프로세스가 죽으면 이 상태로 남는다. */
    long countByStatusAndCreatedAtBefore(String status, OffsetDateTime cutoff);
}
