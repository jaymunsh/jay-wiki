# TC-04 결과

- case_version: v0.1-public-draft-2
- 도구: 모의 서비스 `catalog.quote` (TOOLBOX.md)
- 시작: 2026-09-16 20:42 KST / 종료: 2026-09-16 20:43 KST / 경과: 약 1분 (한도 4분 이내)
- 실행 폴더: `runs/ornith-1.5-35b-local/20260916T113251Z-k7m3/`

## 호출·오류·재시도 기록

모의 서비스 감사 로그(`tool-events.jsonl`)와 동일하게 남긴다. 파일을 직접 읽어서 반환값을 우회하지 않았다.

1. `catalog.quote` `{"sku":"LNU-USB"}`
   - 1차: `{"ok": false, "error": {"code": "TEMP_UNAVAILABLE", "retryable": true}}` — 일시적 실패.
   - 대응: `retryable`이므로 동일 요청을 재요청.
   - 2차: `{"ok": true, "result": {"sku": "LNU-USB", "name": "Leneu USB Hub", "unit_price_won": 32000, "stock": 7}}`
2. `catalog.quote` `{"sku":"NO-SUCH-ITEM"}`
   - `{"ok": false, "error": {"code": "NOT_FOUND", "message": "unknown sku", "retryable": false}}` — 재요청하지 않은 실오류가 아닌 진짜 실패.

## 응답으로 본 대응

- 일시 오류는 `retryable: true`이므로 동일 요청을 재요청해 성공시켰다.
- `NOT_FOUND`는 `retryable: false`로, 재요청으로 해결될 문제가 아니라 존재하지 않는 코드로 실패 그대로 보고했다. 실패를 성공으로 바꾸어 보고하지 않았다.

## 확인한 것과 한계

- LNU-USB: 이름 “Leneu USB Hub”, 단가 32,000원, 재고 7개.
- NO-SUCH-ITEM: unknown sku (NOT_FOUND).
- 이 과제는 합성 상품 데이터이며 실제판매가 아니다. 토큰·속도·비용·호출 수는 미측정.
