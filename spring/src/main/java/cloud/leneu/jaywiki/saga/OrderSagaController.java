package cloud.leneu.jaywiki.saga;

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
@RequestMapping("/api/saga/orders")
@RequiredArgsConstructor
public class OrderSagaController {
    private final OrderSagaService service;

    @PostMapping
    public OrderSagaView run(@Valid @RequestBody OrderSagaRequest request) {
        return service.run(request);
    }

    @GetMapping("/{sagaId}")
    public OrderSagaView get(@PathVariable String sagaId) {
        return service.get(sagaId);
    }

    @GetMapping
    public List<OrderSagaView> recent(@RequestParam(defaultValue = "20") int size) {
        return service.recent(size);
    }
}
