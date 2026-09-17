# CODE-01 결과

- 상태: submitted (산출물 제출 상태이며 독립 채점 아님)
- 시작: 2026-09-13T14:32:48.3Z
- 종료: 2026-09-13T14:32:48.3Z
- 구현: 공개 인터페이스 `canBook(existing, start, end)`를 유지하고 `[start,end)` 규칙에 맞게 `start < b && end > a`로 겹침을 판정했다. 입력 배열·기존 구간·신규 구간의 형식, 정수 범위와 `start < end`를 검사해 잘못된 값은 `RangeError`를 던진다.
- 테스트: 같은 예약, 부분 겹침, 포함, 양쪽 인접, 빈 목록, 배열 불변성과 잘못된 입력을 `test_booking.mjs`에서 확인했다.
- 실행 결과: `node test_booking.mjs` → `CODE-01: all assertions passed`.
- 호출·토큰·비용: 플랫폼에서 제공되지 않아 미측정(null).
