package cloud.leneu.jaywiki.domainlab;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DomainScenarioStepRepository extends JpaRepository<DomainScenarioStep, Long> {
    List<DomainScenarioStep> findByRunIdOrderBySequenceNo(String runId);
}
