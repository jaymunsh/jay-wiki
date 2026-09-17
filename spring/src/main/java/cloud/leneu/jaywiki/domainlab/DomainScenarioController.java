package cloud.leneu.jaywiki.domainlab;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/domain-scenarios")
@RequiredArgsConstructor
public class DomainScenarioController {
    private final DomainScenarioService service;
    private final PartnerApiRehearsalService partnerApiRehearsalService;

    @PostMapping("/{scenario}/runs")
    public DomainScenarioView run(@PathVariable String scenario, @Valid @RequestBody RunRequest request) {
        DomainScenarioType type = DomainScenarioType.fromSlug(scenario);
        if (type == DomainScenarioType.PARTNER_API) {
            return partnerApiRehearsalService.run(request.mode());
        }
        return service.run(type, request.mode());
    }

    @GetMapping("/{scenario}/runs")
    public List<DomainScenarioView> recent(@PathVariable String scenario,
                                           @RequestParam(defaultValue = "8") int size) {
        return service.recent(DomainScenarioType.fromSlug(scenario), size);
    }

    public record RunRequest(@NotBlank String mode) {
    }
}
