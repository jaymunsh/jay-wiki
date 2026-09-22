# TC-04 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.1-public-draft-2
- 시작/종료: 추정 (실시간 측정 아님)
- 산출물: RESULT.md
- 도구: `python3 cases/v0.1/toolbox.py` (catalog.quote ×3, catalog.list), bash

## 주장과 근거

- **LNU-USB 견적 + 일시 오류 재요청**: 첫 견적 요청은 일시 오류를 반환했고, 재요청으로 성공했다.
- **존재하지 않는 SKU**: 알려지지 않은 SKU는 `NOT_FOUND` 업무 오류로 반환된다.
- **종료 코드로 오류 판단 금지**: 일시 오류 응답도 프로세스가 정상 종료(exit 0)하므로, `ok: false`와 `error.retryable` 필드로만 오류 종류를 판단한다.

## 실제 도구 호출 (명령 + 반환)

명령(공통):
```
python3 cases/v0.1/toolbox.py --workspace runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace --tool catalog.quote --args-file runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace/tc04_quote1.json
```

1차 LNU-USB(일시 오류):
```json
{"ok": false, "error": {"code": "TEMP_UNAVAILABLE", "message": "temporary service failure; retry this request", "retryable": true}}
```
종료 코드 0(프로세스는 정상 종료). 재요청이 필요한业务 오류임을 `retryable: true`로 확인.

2차 LNU-USB(재요청 성공):
```json
{"ok": true, "result": {"sku": "LNU-USB", "name": "Leneu USB Hub", "unit_price_won": 32000, "stock": 7}}
```

NO-SUCH-ITEM:
```
python3 cases/v0.1/toolbox.py --workspace runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace --tool catalog.quote --args-file runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace/tc04_quote2.json
```
```json
{"ok": false, "error": {"code": "NOT_FOUND", "message": "unknown sku", "retryable": false}}
```

catalog.list:
```json
{"ok": true, "result": ["LNU-USB", "LNU-STAND"]}
```

## 검증 결과

- 일시 오류 응답의 `retryable`이 `true`, NOT_FOUND의 `retryable`이 `false`로 구분됨을 확인.
- 재요청 후 실제 상품 정보(가격 32000원, 재고 7) 획득 확인.
- catalog.list에 LNU-USB가 존재함으로 교차 확인.

## 미확인 사항

- 이 세션은 파일 격리 환경이 아니므로, 도구 호출 제한과 구현 파일/`tool-state.json` 미읽기 규칙은 지시문에 의한 제한으로만 적용한다.
- 감사 로그 `tool-events.jsonl`은 직접 읽지 않고 도구 반환값으로만 검증했다.
