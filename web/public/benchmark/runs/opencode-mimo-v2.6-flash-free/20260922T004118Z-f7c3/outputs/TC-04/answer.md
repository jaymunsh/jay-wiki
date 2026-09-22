# TC-04 답변

## LNU-USB 조회 (재시도 성공)

- 1차 조회: 일시 오류 — `{"ok": false, "error": {"code": "TEMP_UNAVAILABLE", "message": "temporary service failure; retry this request", "retryable": true}}`
- 2차 조회(재시도): 성공

| 항목 | 값 |
|---|---|
| SKU | LNU-USB |
| 상품명 | Leneu USB Hub |
| 단가 | 32,000원 |
| 재고 | 7 |

## NO-SUCH-ITEM 조회

실패. `{"ok": false, "error": {"code": "NOT_FOUND", "message": "unknown sku", "retryable": false}}` — 재시도 불가능한 오류이므로 더 이상 시도하지 않았다. 이 오류를 성공으로 바꾸어 보고하지 않는다. 해당 SKU의 이름·단가·재고는 확인할 수 없다.

## 참고

`catalog.list` 결과 사용 가능 상품 코드는 `LNU-USB`, `LNU-STAND`다. NO-SUCH-ITEM은 목록에 없다.
