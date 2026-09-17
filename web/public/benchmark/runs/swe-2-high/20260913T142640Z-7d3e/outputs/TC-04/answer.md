# TC-04 답변

## LNU-USB

- 이름: Leneu USB Hub
- 단가: 32,000원
- 재고: 7개

첫 조회는 `TEMP_UNAVAILABLE`(일시 오류, retryable)을 반환해 동일 요청으로 재시도했고, 두 번째 호출에서 위 결과를 확인했습니다.

## NO-SUCH-ITEM

`catalog.quote`가 `NOT_FOUND`(retryable: false, "unknown sku")를 반환했습니다. `catalog.list`로 확인한 등록 상품 코드는 `LNU-USB`, `LNU-STAND` 두 개이므로 `NO-SUCH-ITEM`은 카탈로그에 없는 코드로 확인됩니다.
