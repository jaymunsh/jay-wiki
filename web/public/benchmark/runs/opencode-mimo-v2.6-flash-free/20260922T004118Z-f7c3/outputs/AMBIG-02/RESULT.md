# AMBIG-02 RESULT

- case_version: v0.5-character-1
- 과제 ID: AMBIG-02
- 상태: submitted (제출 상태이며 채점 통과가 아님, 자기 점수 없음 — 미채점)
- 시작(UTC): 2026-09-22T01:20:46Z (AMBIG-01 갱신 직후 관측)
- 종료(UTC): 2026-09-22T01:21:10Z (테스트 전부 통과 관측)
- 소요: 24초 (agent-observed, 터미널 `date -u`)
- 사용 입력: 없음 (문제지 명세만 사용)
- 산출물: `retry.mjs`, `assumptions.md`, `test.mjs`, `RESULT.md`

## 확인한 동작

- `node test.mjs` → **AMBIG-02 TESTS PASSED** (exit 0)
  - 1차 성공 시도 1회·리턴값 보존(객체·falsy 0 포함)
  - 2회 실패 후 성공 → 총 3회, 지연 관측값 `[200, 400]` (sleep 주입)
  - 상한 적용: base 1000/max 1500 → `[1000, 1500, 1500]`
  - 항상 실패 → 3회 후 **마지막 오류(`E3`)** throw
  - `retryOn`으로 401 유사 영구 오류 즉시 중단(시도 1회)
  - `maxAttempts: 1` → 재시도 0회, `fn` 비함수·`maxAttempts: 0` → RangeError
- 명세 없는 판단 11건은 `assumptions.md`에 문서화(최대 3회, 지수 백오프, throw=실패, 마지막 오류 재던지기 등).

## 과정 중 수정한 것

- 테스트의 `maxAttempts=1` 블록에서 옵션 누락으로 기본 3회가 실행되어 기대값과 어긋났다(구현 불변, 테스트에 `maxAttempts: 1` 명시 후 통과).

## 미확인 사항

- 명세가 "실패" 정의·지연·최대 횟수를 비워 뒀다. 기본값(3회/200ms 지수/전 오류 재시도)이 평가자 기단과 다를 수 있음 — `assumptions.md`에 근거 있음.
- 실제 네트워크 대상 미검증(모의 `fn`만). 독립 채점 전 — 미채점.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
