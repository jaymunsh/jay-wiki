package cloud.leneu.jaywiki.domainlab;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "public", name = "tb_domain_scenario_step")
@Getter
@Setter
public class DomainScenarioStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String runId;
    private int sequenceNo;
    private String action;
    private String actor;
    private String status;
    private String detail;
}
