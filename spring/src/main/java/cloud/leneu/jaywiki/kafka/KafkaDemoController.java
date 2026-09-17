package cloud.leneu.jaywiki.kafka;

import jakarta.validation.Valid;
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
@RequestMapping("/api/kafka/orders")
@RequiredArgsConstructor
public class KafkaDemoController {
    private final KafkaDemoOrderService service;

    @PostMapping
    public KafkaDemoOrderView create(@Valid @RequestBody KafkaDemoCreateOrderRequest request) {
        return service.create(request);
    }

    @GetMapping("/{orderId}")
    public KafkaDemoOrderView get(@PathVariable String orderId) {
        return service.get(orderId);
    }

    @GetMapping
    public List<KafkaDemoOrderView> recent(@RequestParam(defaultValue = "12") int size) {
        return service.recent(size);
    }
}
