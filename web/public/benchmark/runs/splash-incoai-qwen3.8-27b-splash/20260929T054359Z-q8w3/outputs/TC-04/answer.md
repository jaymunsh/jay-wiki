# TC-04 답안

## LNU-USB (재시도 후 확인)

- 이름: Leneu USB Hub
- 단가: 32,000원
- 재고: 7

첫 조회에서는 서비스의 의도된 일시 오류(`TEMP_UNAVAILABLE`, retryable)를 받았고, 재요청에 성공해 위 값을 확인했다.

## NO-SUCH-ITEM

- 조회 결과: `NOT_FOUND` — “unknown sku” (`retryable: false`).
- 존재하지 않는 상품 코드이며, 재시도로 해결될 오류가 아니므로 재시도하지 않았다. 확인 가능한 결과는 “등록되지 않은 상품”이다.

오류 응답을 성공처럼 바꾸어 보고하지 않았다.
