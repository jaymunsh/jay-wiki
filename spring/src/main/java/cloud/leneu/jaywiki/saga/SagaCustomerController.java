package cloud.leneu.jaywiki.saga;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 주문 화면의 구매자 드롭다운용. 시드한 데모 구매자가 전부다.
 *
 * /api/saga/orders 아래 두면 /{sagaId} 템플릿이 먼저 잡아간다. 그래서 경로를 따로 뗐다.
 */
@RestController
@RequestMapping("/api/saga/customers")
@RequiredArgsConstructor
public class SagaCustomerController {
    private final OrderSagaService service;

    @GetMapping
    public List<OrderSagaView.CustomerState> customers() {
        return service.customers();
    }
}
