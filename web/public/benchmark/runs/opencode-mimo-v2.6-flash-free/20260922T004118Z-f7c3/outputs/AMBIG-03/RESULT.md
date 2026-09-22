# AMBIG-03 RESULT

- case_version: v0.5-character-1
- 과제 ID: AMBIG-03
- 상태: submitted (제출 상태이며 채점 통과가 아님, 자기 점수 없음 — 미채점)
- 시작(UTC): 2026-09-22T01:21:10Z (AMBIG-02 테스트 통과 관측 직후)
- 종료(UTC): 2026-09-22T01:21:37Z (테스트 전부 통과·해시 확인 관측)
- 소요: 27초 (agent-observed, 터미널 `date -u`)
- 사용 입력: `input/ambig03-spec.md`
  - SHA-256: `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625`
  - sources.json의 AMBIG03-SPEC과 **일치** 확인
- 산출물: `solution.mjs`, `assumptions.md`, `test.mjs`, `RESULT.md`

## 확인한 동작

- `node test.mjs` → **AMBIG-03 TESTS PASSED** (exit 0)
  - 성공 즉시 반환(1회), 일시 오류 2회 후 성공 → 총 3회·대기 `[200, 400]` (§4 지수·상한·지터 없음)
  - 401 → 즉시 실패(재시도·exhausted 없음), 400 → 즉시, 429 → 일시로 3회 재시도 (§2 4xx 중 429 제외)
  - status 없는 오류(네트워크 단절 유사) → 일시 3회, `retry.attempt`/`retry.reason`/`retry.exhausted` 로그·이벤트 확인 (§6)
  - 대기 누적 600ms < 5,000ms → 기본 경로에서 §7 5초 안전망 미도달, exhausted 1회
  - `fn` 비함수 → RangeError
- 명세 충돌(§3 최대 3회 vs §7 성공할 때까지)을 문서화하고 **§3 채택** 근거를 `assumptions.md`에 기록. 멱등 키·배치 예외 등 판단 10건 추가 기록.
- 작성 중 `assumptions.md`에 한자 오염 1건(이론적 표기) → "이론적"으로 수정, 재스캔 0건.

## 미확인 사항

- `fn`에 실제 게이트웨이 시뮬레이션 외 네트워크 검증 없음. 멱등 키 보증은 `fn` 책임으로 남김(래퍼가 키를 발급할 정보 없음) — 평가자가 다르게 볼 수 있는 해석 지점.
- 독립 채점 전 — 미채점.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
