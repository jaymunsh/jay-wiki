# CODE-01 RESULT

- 시작: 2026-09-13T16:37:33Z, 종료: 2026-09-13T16:37:50Z (agent-observed, 터미널 UTC, 테스트 15/15 통과 16:37:42Z 관측). 경과 약 45초 (한도 8분 이내).
- 시작점 결함: 원본 `start <= b && end >= a`는 half-open `[start,end)`에서 인접 예약(예: 기존 [60,120], 신규 [120,180])을 겹침으로 오판하고, 잘못된 입력 검증이 없음. 실제 데모: 원본식은 인접 예약을 false(불가)로 반환.
- 수정(공개 인터페이스 `canBook(existing, start, end)` 유지): 겹침 판정을 `start < b && a < end`로 변경. 정수 분·`0 <= start < end <= 1440`·기존 구간 형식 검증 추가, 위반 시 `RangeError`. 입력 배열 변경 없음.
- 검증: `node test_booking.mjs` 15/15 통과 — 같은 예약, 일부 겹침(앞/뒤), 포함 관계(양방향), 양쪽 인접(true), 빈 목록(true), 입력 불변, 잘못된 입력 6종 RangeError.
- 토큰·속도·비용: 미측정(not_exposed).
- 상태: submitted.
