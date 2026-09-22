# TC-02 RESULT.md

- 상태: submitted
- 시작: 2026-09-16T02:17:14Z / 종료: 2026-09-16T02:17:40Z (agent-observed)
- 시각 변환: "내일" = 기준일(서울 2026-09-14) + 1일 = 2026-09-15, 오후 3시 KST = 06:00Z, +45분 = 06:45Z
- 사용 도구: 모의 서비스 `calendar.create`(1회 성공), `calendar.list`(1회, 생성 확인). 명령은 cases/v0.1/toolbox.py, --workspace는 이번 실행의 tool-workspace.
- 제출물: request.json(작성 요청), response.json(create 반환), response-list.json(list 반환), answer.md
- 실제 캘린더에 쓰지 않음. 도구 감사 로그는 tool-workspace/tool-events.jsonl에 기록됨.
- 토큰·속도·비용: not_exposed
