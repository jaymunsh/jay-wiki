# H-03 결과

- case_version: v0.1-public-draft-2
- 한도: 8분 / 경과: 약 2분 (2026-09-16 20:44~20:46 KST)
- 산출물: `outputs/H-03/shipping.py`, `outputs/H-03/test_shipping.py`
- 실행 폴더: `runs/ornith-1.5-35b-local/20260916T113251Z-k7m3/`

## 규칙

1,000g까지 3,000원, 초과 중량은 시작된 500g 구간마다 500원 추가, 주문액 50,000원 이상은 무료. 중량 0 이하·주문액 음수는 입력 오류(ValueError). 금액과 중량은 정수.

## 발견한 결함 (실행 전 테스트 3개 실패)

```
FAIL: test_free_threshold    AssertionError: 4000 != 0
FAIL: test_next_band         AssertionError: 3500 != 4000
FAIL: test_partial_band      AssertionError: 3000 != 3500
```

결함 2가지:

1. 무료 조건이 `order_total_won > 50000`이었으나 규칙은 “50,000원 이상”이므로 `>= 50000`이어야 한다. 50,000원인 경우 무료가 아니어서运费가 계산되었다.
2. 초과 중량 계산이 `int(max(0, weight_grams - 1000) / 500)`으로 정수 내림(절삭)을 쓰였다. “시작된 500g 구간마다”는 올림(ceil)이어야 한다. 1,001g, 1,501g처럼 500g을 약간 초과한 경우 한 구간 덜 계산되었다.

## 수정 (구현만 변경, 테스트는 변경 안 함)

```python
import math

def shipping_fee(weight_grams, order_total_won):
    if weight_grams <= 0 or order_total_won < 0:
        raise ValueError("invalid input")
    if order_total_won >= 50000:
        return 0
    excess = weight_grams - 1000
    if excess <= 0:
        return 3000
    return 3000 + math.ceil(excess / 500) * 500
```

## 수정 후 테스트 출력

```
Ran 6 tests in 0.000s
OK
```

6개 테스트 모두 통과. 공개 테스트(`test_shipping.py`)는 수정하지 않고 구현(`shipping.py`)만 바꿨다.

## 도구 수

본 공개 초안은 제공된 실제 하네스를 사용하므로 “모든 모델에게 동일한 도구 20개를 제공한 시험”으로 표시하지 않는다. 이번 실행에서 제공된 도구 목록과 그 수를 확인할 수 없어 미측정으로 남긴다.
