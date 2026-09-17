# H-03 RESULT

## 결함 원인 (수정 전)

`outputs/H-03/shipping-before.py` (원본 그대로 보존):

```python
if order_total_won > 50000:          # 규칙: 50,000원 '이상' 무료 → >= 이어야 함
    return 0
return 3000 + int(max(0, weight_grams - 1000) / 500) * 500   # int()는 내림 → '시작된 500g 구간'마다 부과하려면 올림(ceil)
```

1. 무료 기준 비교가 `>` 이라서 주문액이 정확히 50,000원일 때 무료가 적용되지 않았다.
2. `int(x / 500)` 는 내림이므로 1,001g처럼 500g 구간을 **일부만** 넘긴 경우 추가 요금이 누락되었다.

## 수정 내용

`outputs/H-03/shipping.py` (제출 파일):

```python
if order_total_won >= 50000:
    return 0
extra_grams = max(0, weight_grams - 1000)
extra_bands = math.ceil(extra_grams / 500)
return 3000 + extra_bands * 500
```

공개 인터페이스(`shipping_fee(weight_grams, order_total_won)`), 입력 검증(`weight_grams <= 0 or order_total_won < 0` → `ValueError`)은 그대로 유지했다. 테스트 파일은 수정하지 않았다.

## 수정 전 테스트 출력 (`test-output-before.txt`)

```text
test_base ... ok
test_exact_band ... ok
test_free_threshold ... FAIL   AssertionError: 4000 != 0
test_invalid ... ok
test_next_band ... FAIL        AssertionError: 3500 != 4000
test_partial_band ... FAIL     AssertionError: 3000 != 3500

Ran 6 tests in 0.049s
FAILED (failures=3)
```

## 수정 후 테스트 출력 (`test-output-after.txt`)

```text
test_base ... ok
test_exact_band ... ok
test_free_threshold ... ok
test_invalid ... ok
test_next_band ... ok
test_partial_band ... ok

Ran 6 tests in 0.000s
OK
```

## 테스트 파일 무변경 증거

- 수정 전 `test_shipping.py` SHA-256: `78c2805de8fea9eae5f4e033ee5ac2d1fe1b9a2c837834228a5d32a8f0188b08`
- 수정 후 `test_shipping.py` SHA-256: `78c2805de8fea9eae5f4e033ee5ac2d1fe1b9a2c837834228a5d32a8f0188b08` (동일)
- 수정 후 `shipping.py` SHA-256: `deb19607cc701c89ab0d4014abbca470468888e76433fb6737d2299f91e35d22`

## 추가 경계값 확인 (공개 테스트 외 자체 점검)

`boundary-check.txt`:

| 입력 (g, 원) | 결과 |
|---|---|
| (1, 0) | 3000 |
| (1000, 0) | 3000 |
| (1000, 49999) | 3000 |
| (1001, 49999) | 3500 |
| (1500, 0) | 3500 |
| (1501, 0) | 4000 |
| (2000, 50000) | 0 |
| (999999, 50000) | 0 |

기대 규칙(1,000g까지 3,000원, 초과 중량은 시작된 500g 구간마다 500원, 50,000원 이상 무료)과 일치한다.

## 실행 환경

- Python: `/Users/REDACTED/.workbuddy-ai/binaries/python/versions/3.13.12/bin/python3` (3.13.12)
- 실행 명령: `python3 -m unittest -v test_shipping` (작업 폴더 `outputs/H-03` 기준)
- 외부 패키지 설치 없음.

## 확인하지 못한 부분

- 이 테스트는 응시자가 사용하는 공개 재현 테스트이며 독립 사후 채점이 아니다. 숨은 추가 케이스의 통과 여부는 알 수 없다.
- 소수(非정수) 중량 입력의 동작은 문제가 정수 입력을 전제로 하므로 별도로 정의하지 않았다.

## 시간 기록

- 시작(UTC): 2026-09-13T14:28:24Z, 종료(UTC): 2026-09-13T14:28:36Z (agent-observed, `date -u`)
- 관측 소요: 12,000 ms (한도 8분 이내)
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 검증

- 검증 방식: 실제 테스트 실행(공개 unittest) + 경계값 직접 실행. 자기 채점 없음. 상태: submitted.
