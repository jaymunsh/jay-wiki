# H-03 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.1-public-draft-2
- 시작/종료: 추정 (실시간 측정 아님)
- 산출물: outputs/H-03/shipping.py(수정), outputs/H-03/test_shipping.py(변경 없음), RESULT.md
- 도구: write_file, bash(python unittest)

## 수정 전후 테스트 출력

**수정 전** (`python3 test_shipping.py -v`): `FAILED (failures=3)`
```
FAIL test_free_threshold:    4000 != 0
FAIL test_next_band:         3500 != 4000
FAIL test_partial_band:      3000 != 3500
```

**수정 후** (`python3 test_shipping.py -v`): `OK` (6 tests)

## 결함 원인과 수정

테스트는 바꾸지 않고 `shipping.py` 구현만 고쳤다. 두 가지 결함:

1. **무료 조건 경계**: `if order_total_won > 50000` → `>= 50000`.
   - 규칙은 "주문액 50,000원 이상은 무료"다. 50,000원 정확히인 경우(test_free_threshold)도 무료여 하는데, `>`는 4000원을 반환했다.
2. **초과 중량 구간**: `int(max(0, weight_grams - 1000) / 500)` → `math.ceil(...)`.
   - 규칙은 "초과 중량은 시작된 500g 구간마다 500원 추가"다. `int()`는 소수를 버려 1g 초과도 0구간으로 처리했다.
   - `math.ceil`으로 "시작된 구간" 기준으로 1001g→+500, 1501g→+1000이 된다.

수정 후 구현:
```python
def shipping_fee(weight_grams, order_total_won):
    if weight_grams <= 0 or order_total_won < 0:
        raise ValueError("invalid input")
    if order_total_won >= 50000:
        return 0
    return 3000 + math.ceil(max(0, weight_grams - 1000) / 500) * 500
```

## 검증

- 공개 테스트 6건全部 통과 확인.
- 테스트 파일 `test_shipping.py`는 수정 전후 동일(구현만 변경).

## 미확인 사항

- 이 테스트는 응시자가 사용하는 공개 테스트이며, 독립 사후 채점이 아니다.
- 이 세션은 파일 격리 환경이 아니므로 도구 호출 제한은 지시문에 의한 제한으로만 적용한다.
