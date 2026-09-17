package cloud.leneu.jaywiki.saga;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 데모 재고를 스스로 채운다.
 *
 * <p>사가 화면은 아무나 눌러 볼 수 있고, 성공한 주문마다 재고가 하나씩 준다. 운영에서 실제로
 * 100 이 4 까지 내려가 있었고, 0 이 되면 그 뒤로는 전부 품절로 떨어져 시나리오가 죽는다.
 * 사람이 psql 로 되돌리는 방법은 있었지만 그건 아무도 안 볼 때 소진된다.
 *
 * <p>임계 밑일 때만 올리고 reserved 는 건드리지 않는다. 통째로 덮으면 그 순간 진행 중인
 * 사가의 예약이 사라진다 — 보상이 이미 푼 재고를 한 번 더 풀게 된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SagaInventoryReplenisher {
    static final int LOW_WATER = 10;
    static final int REFILL_TO = 100;

    private final SagaInventoryRepository inventoryRepo;

    @Scheduled(fixedDelayString = "${app.saga.replenish-delay:10m}")
    @Transactional
    public void replenish() {
        inventoryRepo.findAll().stream()
                .filter(item -> item.getAvailable() < LOW_WATER)
                .forEach(item -> {
                    log.info("데모 재고를 채운다. {} {} -> {}", item.getProductCode(), item.getAvailable(), REFILL_TO);
                    item.setAvailable(REFILL_TO);
                    item.setUpdatedAt(OffsetDateTime.now());
                });
    }
}
