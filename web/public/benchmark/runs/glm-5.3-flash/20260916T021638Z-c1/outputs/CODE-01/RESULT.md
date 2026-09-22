# CODE-01 RESULT.md

- 상태: submitted
- 시작: 2026-09-16T02:19:47Z / 종료: 2026-09-16T02:20:05Z (agent-observed)
- 원 코드 결함: `start <= b && end >= a`는 접점(기존 종료 = 신규 시작 등)도 겹침으로 판정하고, 입력 검증이 전혀 없었다. `[start,end)` 반열린 구간 기준 올바른 겹침 조건 `start < b && end > a`로 수정.
- 추가 구현: 기존/신규 구간의 정수·범위(0 <= start < end <= 1440) 검증 실패 시 RangeError, existing 배열·각 구간 형식 검증, 입력 배열 불변 유지. 공개 인터페이스(함수명·시그니처) 유지.
- 테스트(booking.test.mjs, node로 실제 실행): 같은 예약, 일부 겹침, 포함 관계, 양쪽 인접(겹침 아님), 빈 목록, start>=end, 범위 초과, 형식 오류, 뒤집힌 구간, 입력 배열 불변 — 10/10 통과(run-output.txt). 이 자체 테스트는 독립 사후 채점이 아님.
- 토큰·속도·비용: not_exposed
