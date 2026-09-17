# CODE-01 RESULT — 예약 충돌 판정 수정

## 제출물

- `outputs/CODE-01/booking.mjs` — 수정본 (공개 인터페이스 `canBook(existing, start, end)` 유지)
- `outputs/CODE-01/booking.test.mjs` — 테스트 코드 (40개 케이스)
- `outputs/CODE-01/test-output-before.txt`, `test-output-after.txt` — 수정 전후 실행 결과
- `outputs/CODE-01/booking-before.mjs`, `before-check.mjs` — 수정 전 원본과 그 동작 기록
- `outputs/CODE-01/hashes.txt` — 파일 해시

## 결함 원인

수정 전 코드 (`booking-before.mjs`, 문제에 제시된 시작점 그대로):

```javascript
export function canBook(existing, start, end) {
  return !existing.some(([a, b]) => start <= b && end >= a);
}
```

1. **인접 구간을 겹침으로 잘못 판정한다.** 반개구간 `[start, end)` 에서는 `start === b` 또는 `end === a` 일 때 겹치지 않는다. 그런데 `<=`·`>=` 를 쓰면 연속된 예약(`[600,660]` 뒤에 `[660,720]`)이 겹치는 것으로 처리되어 거부된다.
2. **입력 검증이 전혀 없다.** 잘못된 값·형식이어도 `RangeError` 대신 불리언을 반환하거나(`[10,10]` → `true`), `existing` 이 배열이 아니면 `RangeError` 가 아니라 `TypeError` 가 난다.

### 수정 전 실제 실행 결과 (`test-output-before.txt`)

```text
같은 예약 [[600,660]] vs [600,660]      (기대 false) -> false
일부 겹침 [[600,660]] vs [630,700]      (기대 false) -> false
신규가 뒤에 인접 [[600,660]] vs [660,720] (기대 true)  -> false      ← 결함
잘못된 신규 [10,10]                     (기대 RangeError) -> true    ← 결함
잘못된 existing [[20,10]]               (기대 RangeError) -> true    ← 결함
existing=null                           (기대 RangeError) -> throw TypeError  ← 결함
빈 목록 [] vs [100,200]                 (기대 true) -> true
```

## 수정 내용

```javascript
export function canBook(existing, start, end) {
  if (!Array.isArray(existing)) throw new RangeError(...);
  assertValidInterval(start, end, 'new interval');          // 정수 여부 + 0 <= start < end <= 1440
  for (let i = 0; i < existing.length; i++) {
    const entry = existing[i];
    if (!Array.isArray(entry) || entry.length !== 2) throw new RangeError(...);
    assertValidInterval(entry[0], entry[1], `existing[${i}]`);
  }
  for (let i = 0; i < existing.length; i++) {
    const a = existing[i][0], b = existing[i][1];
    if (start < b && end > a) return false;                 // 반개구간 겹침 판정
  }
  return true;
}
```

- 겹침 조건을 `start < b && end > a` 로 바꿔 인접 구간을 겹침에서 제외했다.
- 신규 구간과 모든 기존 구간을 검증해 잘못된 값·형식이면 `RangeError` 를 던진다. 검증 대상: 숫자 여부, 정수 여부, `0 <= start < end <= 1440`, 기존 항목이 길이 2의 배열인지.
- 입력 배열과 내부 구간을 읽기만 하고 쓰지 않는다(불변).
- 공개 인터페이스 `canBook(existing, start, end) -> boolean` 과 모듈의 named export 를 그대로 유지했다.

## 수정 후 실제 실행 결과

실행 명령: `node booking.test.mjs` (작업 폴더 `outputs/CODE-01`)

```text
========================================================
총 40개 · 통과 40 · 실패 0
```

전체 출력은 `test-output-after.txt` 에 있다.

### 요구된 케이스별 결과

| 케이스 | 입력 | 결과 |
|---|---|---|
| 같은 예약 | `[[600,660]]`, 600, 660 | `false` (불가) |
| 일부 겹침 (뒤) | `[[600,660]]`, 630, 700 | `false` |
| 일부 겹침 (앞) | `[[600,660]]`, 540, 610 | `false` |
| 포함 (신규 ⊃ 기존) | `[[600,660]]`, 500, 700 | `false` |
| 포함 (기존 ⊃ 신규) | `[[500,700]]`, 600, 660 | `false` |
| 양쪽 인접 (뒤) | `[[600,660]]`, 660, 720 | `true` |
| 양쪽 인접 (앞) | `[[600,660]]`, 540, 600 | `true` |
| 빈 목록 | `[]`, 100, 200 | `true` |
| 하루 경계 | `[[1,2]]`, 0, 1 / 2, 1440 | `true` / `true` |
| 하루 경계 겹침 | `[[1,2]]`, 0, 1440 | `false` |
| 잘못된 신규 구간 13종 | `[10,10]`, `[20,10]`, `[-1,10]`, `[10,1441]`, `[10.5,20]`, `[NaN,20]`, `['10',20]`, `[Infinity,20]` 등 | 전부 `RangeError` |
| 잘못된 기존 구간 12종 | `[[10,10]]`, `[[20,10]]`, `[[10]]`, `[[10,20,30]]`, `[null]`, `['10,20']`, `[10]` 등 | 전부 `RangeError` |
| `existing` 이 배열이 아님 | `null` / `undefined` / `'x'` | 전부 `RangeError` |
| 입력 불변 | `[[600,660],[700,800]]` 로 두 번 호출 | 배열 JSON·원소 참조·길이 모두 동일 |

## 실행 환경

- Node.js: `/Users/REDACTED/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin/node` (v22.22.2)
- 외부 패키지 설치 없음. 표준 모듈 `node:assert/strict` 만 사용.
- `booking.test.mjs` 는 `node:test` 러너가 아니라 자체 하네스로 실행되는 스크립트다. 실행 명령은 `node booking.test.mjs`.

## 파일 해시 (`hashes.txt`)

| 파일 | SHA-256 |
|---|---|
| `booking.mjs` | `19277727398a19b426772553b17f4db45e8023b6cd3cd72c3bcf0153fafe766a` |
| `booking.test.mjs` | `2e06c1d6b7248e3fc4584e1cbf04d6c5a91e066db583fbfa5f1e6a7b785f0ad1` |
| `booking-before.mjs` | `1372a2125f3b2e9437d11b80d96751a05c7cf5218eae2346cf6bdc88bf19e905` |
| `before-check.mjs` | `f08ede10224f35d49e33da4929f0055855cb7e8b4a826b72e827c9aadb01ddc4` |

## 확인하지 못한 부분

- 기존 예약 목록이 서로 겹치거나 정렬되지 않은 경우의 동작은 정의하지 않았다. 문제는 “인접한 예약은 겹치지 않는다”는 전제를 주므로 목록 자체의 정합성은 검사하지 않는다.
- 숨은 추가 테스트의 통과 여부는 알 수 없다. 위 40개는 응시자가 작성한 공개 테스트이며 독립 사후 채점이 아니다.
- 성능(대량 목록)은 측정하지 않았다.

## 시간 기록

- 시작(UTC): 2026-09-13T14:50:54Z, 종료(UTC): 2026-09-13T14:51:31Z (agent-observed, `date -u`)
- 관측 소요: 38,000 ms. 한도 8분 이내.
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 검증

- 검증 방식: 실제 테스트 실행(수정 전후 대조). 자기 채점 없음. 상태: submitted.
