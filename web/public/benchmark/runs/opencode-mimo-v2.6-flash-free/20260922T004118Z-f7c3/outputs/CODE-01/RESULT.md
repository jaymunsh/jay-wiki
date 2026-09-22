# CODE-01 RESULT

- 과제 ID: CODE-01 / 문제 버전: v0.1-public-draft-2
- 상태: submitted (제출 상태이며 채점 통과가 아님. 이 테스트는 공개 테스트이며 독립 사후 채점이 아니다)
- 시작(UTC): 2026-09-22T00:50:46Z
- 종료(UTC): 2026-09-22T00:50:57Z (테스트 재실행·결과 저장 직후 관측)
- 소요: 11초 (agent-observed, 터미널 `date -u`)
- 산출물: `outputs/CODE-01/booking.mjs`, `booking.test.mjs`, `test-run.txt`

## 진단한 결함

원본 시작점: `return !existing.some(([a, b]) => start <= b && end >= a);`

1. **인접 구간 오거부**: `[start,end)` 규칙에서 앞 예약 종료 == 새 시작(예: 기존 [60,120), 신규 [120,180))은 겹치지 않아야 하나 `120 <= 120 && 180 >= 60`이 참이어 거부됨.
2. **입력 검증 부재**: 잘못된 값·형식에 `RangeError`를 던지지 않음(비배원소는 비표준 TypeError 등).

## 수정

- 겹치지 않는 판정을 `start < b && end > a`로 변경(반열린 구간 정확히 표현, 양쪽 인접 허용).
- 검증 추가: `existing` 배열 형식·각 구간의 길이·정수성·`0 <= a < b <= 1440`·신규 `0 <= start < end <= 1440` 위반 시 `RangeError`.
- 입력 배열과 내부 배열을 변경하지 않음(freeze된 입력으로 확인).
- 공개 인터페이스 `export function canBook(existing, start, end)` 유지.

## 실제 검증

`node outputs/CODE-01/booking.test.mjs` → **24 passed, 0 failed** (exit 0).

- 커버: 빈 목록, 같은 예약, 일부 겹침(좌/우), 포함 관계(양방향), 양쪽 인접(허용), 다중 예약(충돌1건/유후 슬롯/전체 앞·뒤), 입력 무변경, 잘못된 입력 10종 RangeError.
- 원본 코드를 별도 스크립트로 실행해 인접 구간 오동작(`false` 반환)을 재현 확인.
- 실행 결과 원문: `test-run.txt`.

## 미확인 사항

- 공개 테스트 외의 대규모 성능(20만 건 등)은 이 과제 명세에 없어 미측정.
- 자체 테스트 통과를 독립 채점 통과로 표현하지 않음.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
