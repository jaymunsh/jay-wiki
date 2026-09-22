# TC-02 RESULT

- 과제 ID: TC-02 / 문제 버전: v0.1-public-draft-2 / 도구: 모의 서비스 calendar.create, calendar.list
- 상태: submitted (제출 상태이며 채점 통과가 아님)
- 시작(UTC): 2026-09-22T00:42:26Z (첫 요청 JSON 작성 시점 관측)
- 종료(UTC): 2026-09-22T00:42:44Z
- 소요: 18초 (agent-observed, 터미널 `date -u`)

## 수행 내용

1. 기준 날짜 서울 2026-09-14 → "내일 오후 3시"를 2026-09-15T06:00:00Z, 45분 종료를 2026-09-15T06:45:00Z로 환산해 `request.json` 작성.
2. `calendar.create` 호출 → `{"ok": true, "result": {..., "event_id": "event-001"}}`.
3. `calendar.list` 호출 → 생성된 일정 1건 확인.
4. 동일 `request_id`로 재호출 후 재조회 → 여전히 1건. 중복 생성 없음(멱등) 확인.

## 실제 실행 명령

```text
python3 leneu-benchmark/cases/v0.1/toolbox.py --workspace runs/opencode-mimo-v2.6-flash-free/20260922T004118Z-f7c3/tool-workspace --tool calendar.create --args-file <run>/outputs/TC-02/request.json
python3 leneu-benchmark/cases/v0.1/toolbox.py --workspace runs/.../tool-workspace --tool calendar.list --args-file <run>/outputs/TC-02/empty-args.json
```

감사 로그 `tool-workspace/tool-events.jsonl`에 create 2회·list 3회가 기록됨을 확인했다(호출 시각 포함).

## 실패와 대응

- 00:42:32 첫 create 호출: 요청 파일에 Markdown 코드 펜스가 섞여 JSON 파싱 실패(`Expecting value`). 파일을 순수 JSON으로 다시 저장한 뒤 재호청에 성공. 실패는 도구 프로그램 입력 오류이며 서비스 업무 오류가 아니다.

## 확인한 것 / 미확인 것

- 확인: 생성·조회 응답 내용, request_id 멱등성, 감사 로그 기록.
- 미확인: 실제 캘린더 연동 없음(모의 서비스 한정). 모의 도구의 내부 상태 파일(tool-state.json)은 읽지 않았다.

## 제약 명시

- 파일 접근이 OS 수준으로 격리되지 않은 세션이며, 도구 구현·tool-state.json을 읽지 않는 것은 지시에 따른 제한이다.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
