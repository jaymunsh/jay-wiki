# H-03 RESULT

- 상태: submitted
- 문제 버전: v0.1-public-draft-2
- 시작: 2026-09-29T06:08:15Z (agent-observed)
- 종료: 2026-09-29T06:09:55Z (agent-observed)
- 경과: 약 100초

## 결함 분석

1. **부분 구간 미산입**: `int((w-1000)/500)`는 초과 1g~499g을 0구간으로 보고 3,000원을 냈다. 기대 규칙은 "시작된 500g 구간마다 500원"이므로 `math.ceil(over/500)`로 수정 (1,001g → 3,500원).
2. **무료 배송 경계**: `order_total_won > 50000`는 정확히 50,000원 주문에 3,000원+구간비를 부과했다. "50,000원 이상은 무료"이므로 `>=`로 수정.

## 테스트 실행 기록

- `test_shipping.py`는 공개된 재현 테스트를 그대로 사용 (수정 없음).
- 수정 전: `python3 test_shipping.py` → `Ran 6 tests ... FAILED (failures=3)` (test_partial_band, test_next_band, test_free_threshold) — `test-output-before.txt`.
- 수정 후: `Ran 6 tests ... OK` — `test-output-after.txt`.

## 산출물

- `shipping.py` (수정 구현), `shipping-original.py` (합성 결함 원본 보존), `test_shipping.py` (미수정), `test-output-before.txt`, `test-output-after.txt`
- 토큰·속도·비용: 미제공 (null, not_exposed).
