# AMBIG-02 RESULT

- case_version: v0.5-character-1
- task: 외부 API 호출 재시도 래퍼
- start (UTC): 2026-09-15T19:21:24Z
- end (UTC): 2026-09-15T19:22:19Z
- duration: 약 55초 (한도 15분 내)
- 측정 방법: `date -u` wall-clock
- 고정 입력: 없음 (해시 없음)

## 확인한 동작 (node 직접 호출, 6건)

- 성공 시 `fn` 반환값 그대로 반환
- 2회 실패 후 3번째 성공 시 성공값 반환(재시도 동작)
- 영구 오류(HTTP 401)는 재시도 없이 즉시 실패
- 재시도 가능 오류(HTTP 429)가 계속되면 최대 3회 후 마지막 오류 throw
- `err.retryable=false` 명시 시 재시도하지 않음
- 비함수 인자 → `TypeError`

## 확인하지 못한 것

- 실제 네트워크 환경에서의 백오프 타이밍 정확도(테스트는 대기 시간을 줄여 검증)
- 출제 의도와 다른 정책(횟수·오류 분류)일 가능성 — 판단 근거는 `assumptions.md`에 기록
- 토큰·속도·비용: not_exposed
