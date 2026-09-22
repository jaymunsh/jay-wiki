# TC-04 답변

## LNU-USB 조회 (첫 요청은 일시 오류 → 재시도로 성공)

- 상품명: **Leneu USB Hub**
- 단가: **32,000원**
- 재고: **7개**

첫 조회에서 서비스가 `TEMP_UNAVAILABLE`("temporary service failure; retry this request", retryable: true)을 반환해, 안내대로 동일 요청을 1회 재시도하여 정상 응답을 받았습니다.

## NO-SUCH-ITEM 조회

서비스가 `ok: false`, 코드 `NOT_FOUND`("unknown sku", retryable: false)를 반환했습니다. 즉 **해당 코드의 상품은 존재하지 않는 것으로 확인**되며, 이 오류는 재시도 대상이 아니므로 재시도하지 않았습니다. 참고로 `catalog.list`의 사용 가능 상품 코드는 `LNU-USB`, `LNU-STAND` 두 개로, `NO-SUCH-ITEM`이 목록에 없음이 교차 확인됩니다.
