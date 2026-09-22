# TC-02 결과

- case_version: v0.1-public-draft-2
- 도구: 모의 서비스 `calendar.create`, `calendar.list` (TOOLBOX.md)
- 기준 날짜: 서울 2026-09-14 (내일 = 2026-09-15)
- 시작: 2026-09-16 20:41 KST / 종료: 2026-09-16 20:42 KST / 경과: 약 1분 (한도 4분 이내)
- 실행 폴더: `runs/ornith-1.5-35b-local/20260916T113251Z-k7m3/`

## 자연어를 정확한 인자로 바꾸기

요청: “내일 오후 3시부터 45분 동안 ‘벤치마크 리뷰’를 잡아줘. 참석자는 jay@example.test와 min@example.test이고 요청 ID는 tc02-review-1이야.”

- “내일” = 기준 날짜(2026-09-14)의 다음 날인 2026-09-15.
- “오후 3시” = 서울 15:00. 이 과제에서 서울은 UTC+09:00이므로 UTC로 바꾸면 06:00.
- “45분 동안” = 종료는 시작 45분 뒤인 15:45 서울 = 06:45 UTC.
- 도구에는 UTC ISO 시각(Z 끝)을 전달한다.

```json
{
  "title": "벤치마크 리뷰",
  "start_utc": "2026-09-15T06:00:00Z",
  "end_utc": "2026-09-15T06:45:00Z",
  "attendees": ["jay@example.test", "min@example.test"],
  "request_id": "tc02-review-1"
}
```

## 도구 호출 기록

1. `calendar.create` — 위 요청 JSON으로 호출.
   - 반환: `{"ok": true, "result": { ... , "event_id": "event-001" }}`
2. `calendar.list` — 빈 객체 `{}`를 args-file로 호출해 생성 확인.
   - 반환: `{"ok": true, "result": [벤치마크 리뷰 event-001 하나]}`

`calendar.list`는 빈 객체를 요구한다. 처음 `{}`가 아닌 파일을 전달했을 때 `ok:false`/`INVALID_ARGUMENT`("expected empty object")를 받았고, 이를 프로세스 종료 코드가 아닌 응답의 `ok` 필드로 판단해 빈 객체 파일로 바꿔 재요청하여 성공시켰다.

## 확인한 것과 한계

- 서울 15:00을 UTC 06:00으로 정확히 변환해 전달했고, 목록 조회로 생성 일정을 확인했다.
- 동일 request_id는 중복 생성하지 않는 모의 서비스 특성상 list에 하나의 일정만 반환된다.
- 실제 캘린더에는 쓰지 않았고, 토큰·속도·비용·호출 수는 제공되어 미측정이다.
