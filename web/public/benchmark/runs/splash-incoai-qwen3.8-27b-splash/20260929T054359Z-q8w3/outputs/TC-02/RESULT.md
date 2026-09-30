# TC-02 RESULT

- 상태: submitted
- 문제 버전: v0.1-public-draft-2
- 시작: 2026-09-29T06:02:38Z (agent-observed)
- 종료: 2026-09-29T06:04:30Z (agent-observed)
- 경과: 약 110초

## 수행 내용

- 자연어 일정을 UTC 인자로 변환: 2026-09-15 15:00 KST = 06:00 UTC, 45분 → 종료 06:45 UTC.
- 요청 JSON을 `request.json`에 작성하고 모의 서비스를 CLI로 순차 호출:
  - `python3 cases/v0.1/toolbox.py --workspace <run>/tool-workspace --tool calendar.create --args-file <run>/outputs/TC-02/request.json` → `ok: true`, `event-001`
  - `--tool calendar.list --args-file <run>/outputs/TC-02/list-args.json`(빈 객체) → 생성된 일정 1건 확인
- 실제 반환 JSON을 `response.json`에 저장했다. 실제 캘린더에는 쓰지 않았다.

## 확인한 동작

- create 직후 list 결과에 event-001이 등장함을 확인.

## 한계

- `tool-state.json`·구현 파일은 문제 규칙상 인터페이스 호출로만 사용하고 직접 읽지 않았다. 파일 접근은 운영체제 수준에서 격리되지 않은 세션이므로 이는 지시문에 의한 제한이다.
- 토큰·속도·비용: 플랫폼 미제공 (null, not_exposed).
