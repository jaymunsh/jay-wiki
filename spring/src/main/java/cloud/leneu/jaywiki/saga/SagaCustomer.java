package cloud.leneu.jaywiki.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 데모 구매자. 가입도 로그인도 없고 마이그레이션에서 시드한 다섯 명이 전부다.
 *
 * 데이터 분리 뒤에는 payment·shipping 이 customer_id 참조만 들고 이름은 안 복제한다.
 * 그래서 "누구의 결제인지" 를 화면에 띄우려면 조인이 아니라 모놀리스의 조립이 된다 —
 * 소유권을 나눴을 때 실제로 겪는 대가를 만드는 것이 이 테이블의 목적이다.
 */
@Entity
@Table(schema = "public", name = "tb_saga_customer")
@Getter
@Setter
public class SagaCustomer {
    @Id
    private String id;
    private String name;
    private String email;
    private String grade;
    private OffsetDateTime createdAt;
}
