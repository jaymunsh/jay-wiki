package cloud.leneu.jaywiki.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 배송 상태의 읽기 전용 사본.
 *
 * PaymentProjection 과 같은 이유로 같은 모양이다. 이 클래스는 "배송의 상태" 가 아니라
 * <b>"우리가 마지막으로 들은 배송의 상태"</b> 다. 원본은 shipping-api 가 자기 DB 에 든다.
 *
 * 여기에 쓰는 것은 Kafka 컨슈머 하나뿐이다. 사가 코드가 직접 고치면 사본이 원본을 앞질러
 * 조용히 틀린다 — 그 순간 분리한 의미가 없어진다.
 */
@Entity
@Table(schema = "public", name = "tb_shipping_projection")
@Getter
@Setter
public class ShippingProjection {
    @Id
    private String orderId;
    private String shipmentId;
    private String status;
    /** 원본에서 그 사실이 일어난 시각. */
    private OffsetDateTime occurredAt;
    /** 우리가 받은 시각. 화면의 "n초 전 기준" 이 이 값을 쓴다. */
    private OffsetDateTime observedAt;
}
