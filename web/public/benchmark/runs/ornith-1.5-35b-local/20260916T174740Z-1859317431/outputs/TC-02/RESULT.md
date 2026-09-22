# TC-02 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.1-public-draft-2
- 시작/종료: 추정 (실시간 측정 아님)
- 산출물: RESULT.md
- 도구: `python3 cases/v0.1/toolbox.py` (calendar.create, calendar.list), bash

## 주장과 근거

- **일정 생성**: 모의 도구 `calendar.create`로 "벤치마크 리뷰" 일정을 생성했다.
- **타임존 변환**: 요청 시각 2026-09-15 15:00 KST(UTC+09)를 UTC로 환산해 `start_utc`에 담았다. 15:00 − 9시간 = 06:00 UTC이므로 `start_utc: 2026-09-15T06:00:00Z`, 1시간 길이의 `end_utc: 2026-09-15T07:00:00Z`로 보냈다.
- **참가자**: 빈 배열이 아닌 이메일 하나(`bench-review@leneu.local`)를 포함했다.
- **request_id**: `tc-02-001`로 부여해 중복 생성 방지 키로 사용했다.

## 실제 도구 호출 (명령 + 반환)

```
python3 cases/v0.1/toolbox.py --workspace runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace --tool calendar.create --args-file runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace/tc02_create.json
```
반환:
```json
{"ok": true, "result": {"title": "벤치마크 리뷰", "start_utc": "2026-09-15T06:00:00Z", "end_utc": "2026-09-15T07:00:00Z", "attendees": ["bench-review@leneu.local"], "request_id": "tc-02-001", "event_id": "event-001"}}
```

```
python3 cases/v0.1/toolbox.py --workspace runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace --tool calendar.list --args-file runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/tool-workspace/tc02_list.json
```
반환:
```json
{"ok": true, "result": [{"title": "벤치마크 리뷰", "start_utc": "2026-09-15T06:00:00Z", "end_utc": "2026-09-15T07:00:00Z", "attendees": ["bench-review@leneu.local"], "request_id": "tc-02-001", "event_id": "event-001"}]}
```

## 검증 결과

- `calendar.list`에 생성한 일정이 event_id `event-001`로 1건 저장되어 반환되었다.
- UTC 시각이 Z 접미사로 끝나고, KST→UTC 환산(06:00Z)이 맞는지 확인.
- attendees가 비어 있지 않음 확인.

## 미확인 사항

- 이 세션은 파일 격리 환경이 아니므로, 도구 호출 제한과 구현 파일/`tool-state.json` 미읽기 규칙은 지시문에 의한 제한으로만 적용한다.
- `tool-events.jsonl` 감사 로그는 직접 읽지 않고, 도구 반환값으로만 검증했다.
