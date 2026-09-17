# CODE-01 RESULT

- 상태: submitted
- 시작(UTC, agent-observed): 2026-09-13T14:48:27Z
- 종료(UTC, agent-observed): 2026-09-13T14:48:43Z
- 경과: 약 16초 (측정 출처: macOS `date -u`)

## 수정 내용

- 겹침 판정을 `[start,end)` 반개구간에 맞게 `start < b && end > a`로 수정. 원본의 `<=`/`>=`는 인접(경계 접촉) 예약도 겹침으로 잘못 판정했다.
- 신규 구간 검증: 정수이고 `0 <= start < end <= 1440`이 아니면 `RangeError`.
- 기존 구간 각각도 `[a,b)` 2원소 배열이며 같은 범위 규칙을 만족하지 않으면 `RangeError`.
- `existing`이 배열이 아니면 `RangeError`. 입력 배열은 순회만 하고 변경하지 않음.
- 공개 인터페이스 `canBook(existing, start, end)` 유지.

## 검증

- `node --test test_booking.mjs` 실행 — 9개 테스트 전부 통과(`test-output.txt`).
- 커버 사례: 빈 목록, 동일 구간, 앞뒤 부분 겹침, 양방향 포함, 양쪽 인접, 분리 구간, 신규/기존 구간의 형식·범위 오류, 입력 불변성.

## 미측정

- 토큰·비용·첫 토큰 시간: 플랫폼 미제공(not_exposed).
