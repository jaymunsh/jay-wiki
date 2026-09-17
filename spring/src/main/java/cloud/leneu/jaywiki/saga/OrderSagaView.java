package cloud.leneu.jaywiki.saga;

import java.time.OffsetDateTime;
import java.util.List;

public record OrderSagaView(
        String sagaId,
        String orderId,
        String status,
        List<SagaStepDto> steps,
        CustomerState customer,
        OrderState order,
        InventoryState inventory,
        PaymentState payment,
        ShippingState shipping
) {
    /** 이름은 모놀리스가 든다. 분리 뒤에도 payment·shipping 은 id 만 알고 이름은 모른다. */
    public record CustomerState(String id, String name, String grade) {
    }

    public record OrderState(String status) {
    }

    public record InventoryState(int available, int reserved) {
    }

    /**
     * observedAt 은 "우리가 이 상태를 마지막으로 들은 시각" 이다. null 이면 아직 못 들었다는 뜻이다.
     *
     * 화면에 드러내려고 든다. 프로젝션 지연을 폴링으로 매끄럽게 감추면 분리한 것과 안 한 것이
     * 화면에서 구분되지 않고, 그러면 분리할 이유가 없어진다.
     */
    public record PaymentState(String status, OffsetDateTime observedAt) {
    }

    /** 배송도 사본이라 payment 와 같다. observedAt 이 null 이면 아직 못 들었다는 뜻이다. */
    public record ShippingState(String status, OffsetDateTime observedAt) {
    }
}
