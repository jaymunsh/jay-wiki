# CODE-01 RESULT — 예약 충돌 판정 수정

- 상태: submitted
- 문제 버전: v0.1-public-draft-2
- 시작: 2026-09-29T11:54:00Z (agent-observed)
- 종료: 2026-09-29T11:59:30Z (agent-observed)
- 경과: 약 330초

## 산출물

- `booking.mjs` — 공개 인터페이스(`export function canBook(existing, start, end)`) 유지한 수정 구현.
- `booking-test.mjs` + `testutil.mjs` — 검증 스크립트 (40개 assertion).
- `bug-demo.mjs` — 원본 버그 코드와 수정판의 대조 실행.

## 버그 분석

원본:
```javascript
return !existing.some(([a, b]) => start <= b && end >= a);
```
`[start,end)` 구간에서 두 구간이 겹치는 조건은 **`start < b && end > a`** (엄격한 부등호)다. 원본은 `<=` / `>=`를 써서 **끝점이 맞닿은 인접 예약까지 "겹침"으로 오분류**한다. 예: 기존 `[100,200)`, 신규 `[200,300)` → `200 <= 200 && 300 >= 100` = true → 예약을 부당하게 거부.

## 수정 내용

- 겹침 판정을 `start < b && end > a`로 교체 → 인접(끝점 공유)은 더 이상 겹치지 않음.
- 신규 구간 검증: 정수 분, `0 <= start < end <= 1440` 위반 시 `RangeError`.
- 기존 구간 전체 검증: 각 `[a,b]`가 2요소 배열이고 정수 분 범위·`a < b`를 만족하지 않으면 `RangeError` (신규 구간과 무관하게 항상 검사).
- `existing`이 배열이 아닌 타입이면 `RangeError`.
- 입력 배열/요소는 **읽기 전용**으로만 사용 — 어떤 경로에서도 변경하지 않음.

## 실행한 검증 (booking-test.mjs, 40/40 통과)

- 같은 예약, 일부 겹침(좌/우 확장), 양방향 포함 → 모두 거부(false).
- **양쪽 인접** (신규 끝=기존 시작, 신규 시작=기존 끝, 양 이웃 인접, 0/1440 경계 인접) → 허용(true).
- 빈 목록, 분리 구간 → 허용.
- 잘못된 신규 입력 10종(start>end, 길이 0, 음수, >1440, 소수, 문자열, null, NaN, Infinity, boolean) → 전부 `RangeError`.
- 잘못된 기존 입력 10종(start>end, 길이 0, 1요소, 3요소, 소수, 문자열 요소, >1440, null, 객체, 배열 아님) → 전부 `RangeError`. 신규와 무관하게 검출.
- 입력 불변성: deepFreeze된 입력과 일반 입력 모두 호출 후 무변경.
- 공개 인터페이스: boolean 반환, `canBook.length === 3`.

## 버그 대조 (bug-demo.mjs 실행 결과)

```
case | expected | original | fixed
same booking | false | false | false
partial overlap | false | false | false
containment | false | false | false
adjacent (the bug) | true | false  <-- WRONG | true
adjacent left | true | false  <-- WRONG | true
empty list | true | true | true

original fails 2 of 6 cases (the adjacent-overlap bug)
fixed passes 6 of 6 cases
```

## 미확인 사항 / 한계

- 토큰·속도·비용: 미제공 (null, not_exposed).
