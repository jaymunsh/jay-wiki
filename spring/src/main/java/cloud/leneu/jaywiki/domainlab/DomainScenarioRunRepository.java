package cloud.leneu.jaywiki.domainlab;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DomainScenarioRunRepository extends JpaRepository<DomainScenarioRun, String> {
    List<DomainScenarioRun> findByScenarioTypeOrderByCreatedAtDesc(String scenarioType, Pageable pageable);
}
