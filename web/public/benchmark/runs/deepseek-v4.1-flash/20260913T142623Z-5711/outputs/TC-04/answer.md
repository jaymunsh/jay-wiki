# TC-04 답변 — 상품 조회 결과

## LNU-USB

- 이름: **Leneu USB Hub**
- 단가: **32,000원**
- 재고: **7개**

첫 조회는 일시 오류(`TEMP_UNAVAILABLE`, `retryable: true`)를 반환했고, 재요청에서 위 값이 정상 반환되었습니다. 오류를 성공으로 바꾸어 보고하지 않고, 재시도 후 실제로 받은 값만 적었습니다.

## NO-SUCH-ITEM

- 결과: **조회 실패**. 오류 코드 `NOT_FOUND`, 메시지 `unknown sku`, `retryable: false`.
- 이 코드는 상품 목록에도 없습니다. `catalog.list`가 반환한 실제 상품 코드는 **LNU-USB, LNU-STAND** 두 개뿐입니다.
- 재시도 대상이 아니라고 서비스가 명시했으므로 반복 호출하지 않았습니다.
