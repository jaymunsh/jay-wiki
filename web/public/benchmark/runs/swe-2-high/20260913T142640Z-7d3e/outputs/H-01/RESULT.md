# H-01 RESULT

- 상태: submitted
- 시작(UTC, agent-observed): 2026-09-13T14:28:19Z
- 종료(UTC, agent-observed): 2026-09-13T14:28:27Z
- 경과: 약 8초 (측정 출처: macOS `date -u`)

## 변경 내용

- `id`가 `document-indexer`인 서비스의 `request_timeout_seconds`를 5 → 30으로 변경.
- 변경 전후 `diff` 결과: 해당 필드 한 곳만 차이(6번째 줄의 `5` → `30`).

## 검증

- `python3 -c "json.load(...)"`으로 파싱 성공.
- 세 서비스의 `request_timeout_seconds`: image-preview=12(유지), document-indexer=30(변경), archive-export=45(유지).
- `retry_count`, `port`, `enabled`, `user_note` 모두 원본과 동일. 키 추가·이름 변경·주석 없음.
- 원본 `cases/v0.1/input/service-config.json`은 미수정(diff 기준으로 복사본만 변경됨을 확인).

## 도구 수

- 이 세션에서 사용 가능한 에이전트 도구 목록을 수치로 확인할 API가 없어 미측정. 실제로 사용한 도구 종류는 read/write/edit/exec/grep/glob 계열 파일·터미널 도구이며, 정확한 총 개수는 플랫폼이 노출하지 않음(not_exposed). '동일한 도구 20개' 조건으로 표시하지 않음.

## 미측정

- 토큰·비용·첫 토큰 시간: 플랫폼 미제공(not_exposed).
