# TC-02 RESULT

- 상태: submitted
- 시작(UTC, agent-observed): 2026-09-13T14:27:15Z
- 종료(UTC, agent-observed): 2026-09-13T14:27:54Z
- 경과: 약 39초 (측정 출처: macOS `date -u`)

## 수행 내용

- 기준일 서울 2026-09-14, "내일 오후 3시부터 45분" → 서울 2026-09-15 15:00–15:45 KST → UTC 2026-09-15T06:00:00Z–06:45:00Z로 변환해 `request.json` 작성.
- `python3 cases/v0.1/toolbox.py --workspace runs/swe-2-high/20260913T142640Z-7d3e/tool-workspace --tool calendar.create --args-file .../request.json` 호출 → `ok: true`, `event_id: event-001`.
- `calendar.list`({})로 확인 → 생성된 일정 1건 반환.

## 확인한 동작

- 생성 응답과 목록 조회 결과가 요청 인자와 일치.
- 실제 캘린더 미사용(모의 서비스).

## 미측정

- 토큰·첫 토큰 시간·비용: 플랫폼 미제공(not_exposed).
