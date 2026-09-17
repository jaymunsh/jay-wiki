# TC-02 RESULT

## 수행 내용

1. 기준 날짜 서울 2026-09-14 → “내일 오후 3시부터 45분” = 2026-09-15 15:00~15:45 KST. 서울을 UTC+09:00으로 정의했으므로 UTC는 `2026-09-15T06:00:00Z` ~ `2026-09-15T06:45:00Z`.
2. `outputs/TC-02/request.json` 작성 (title, start_utc, end_utc, attendees, request_id).
3. 모의 도구 `calendar.create` 1회 호출 → `ok: true`, `event_id: event-001`.
4. 모의 도구 `calendar.list` 1회 호출 → 생성된 일정 1건 확인.
5. 추가 검증: 동일 `request_id`로 `calendar.create` 재전송 → 여전히 `event-001`, `calendar.list` 결과도 1건 → 중복 생성 없음 확인.

## 실제 호출 명령

```text
python3 cases/v0.1/toolbox.py --workspace runs/deepseek-v4.1-flash/20260913T142623Z-5711/tool-workspace --tool calendar.create --args-file runs/deepseek-v4.1-flash/20260913T142623Z-5711/outputs/TC-02/request.json
python3 cases/v0.1/toolbox.py --workspace runs/deepseek-v4.1-flash/20260913T142623Z-5711/tool-workspace --tool calendar.list --args-file runs/deepseek-v4.1-flash/20260913T142623Z-5711/outputs/TC-02/list-args.json
```

사용한 Python: `/Users/REDACTED/.workbuddy-ai/binaries/python/versions/3.13.12/bin/python3` (3.13.12). 명령 예시의 `python3` 대신 절대 경로 인터프리터를 사용했다.

## 모의 서비스 반환값 (원문)

- create: `{"ok": true, "result": {"title": "벤치마크 리뷰", "start_utc": "2026-09-15T06:00:00Z", "end_utc": "2026-09-15T06:45:00Z", "attendees": ["jay@example.test", "min@example.test"], "request_id": "tc02-review-1", "event_id": "event-001"}}`
- list: `{"ok": true, "result": [ ... event-001 1건 ... ]}`
- 재전송 create: 동일 `event-001` 반환, list 결과 1건 유지.

## 감사 로그

`tool-workspace/tool-events.jsonl`에 4줄이 기록됐다(create, list, create-재전송, list-재확인). 각 줄의 `at_utc` 타임스탬프를 원문 그대로 보존했다.

## 확인한 내용

- 자연어(“내일 오후 3시부터 45분”)를 정확한 UTC 인자로 변환해 전달했다.
- 생성·조회 결과가 일치하며 `request_id` 기준 중복 방지가 동작한다.

## 확인하지 못한 부분

- 실제 캘린더 서비스 연동은 하지 않았다(모의 서비스이며 문제에서 실제 캘린더 사용을 금지).
- 모의 도구 구현 파일과 `tool-state.json`은 읽지 않았다. 반환값은 인터페이스 응답으로만 확인했다.

## 시간 기록

- 시작(UTC): 2026-09-13T14:26:52Z, 종료(UTC): 2026-09-13T14:27:13Z (agent-observed, `date -u`)
- 관측 소요: 21,000 ms (한도 4분 이내)
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 격리 한계

모의 도구 파일 접근은 운영체제 수준에서 격리되지 않았다. “구현 파일을 읽지 않는다”는 규칙은 지시문에 의한 제한이며 기술적 강제가 아니다.

## 검증

- 검증 방식: 모의 도구 목록 조회 결과 대조(실제 실행), 감사 로그 확인. 자기 채점 없음. 상태: submitted.
