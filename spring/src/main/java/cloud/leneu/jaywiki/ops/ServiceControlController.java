package cloud.leneu.jaywiki.ops;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.SequencedCollection;

@RestController
@RequestMapping("/api/admin/services")
@RequiredArgsConstructor
public class ServiceControlController {

    private final ServiceControlService service;

    @GetMapping
    public SequencedCollection<ServiceStatusDto> list() {
        return service.list();
    }

    @PostMapping("/{key}/scale")
    public ServiceStatusDto scale(@PathVariable String key, @Valid @RequestBody ServiceScaleRequest request) {
        return service.scale(key, request.replicas());
    }
}
