# RESULT — AMBIG-02 (외부 API 호출 재시도 래퍼)

- case: AMBIG-02 · v0.5-character-1 (구간 3)
- model: splash/incoai/Qwen3.8-27B-Splash · 고정 입력: 없음
- 시작: 2026-09-30T05:36Z / 종료: 2026-09-30T05:45Z / 경과: 약 9분
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 구현
`retry.mjs` → `export async function callWithRetry(fn, options = {})`.
`test.mjs` → node:test 5개. **5/5 통과** (`node --test AMBIG-02/test.mjs`).

## 확인한 동작 (테스트로 검증)
- 첫 시도 성공 → 값 그대로 반환('ok-value').
- 2회 실패 후 성공 → 3회 호출 끝에 'recovered'.
- 전부 실패 → 마지막 오류(`fail-3`)로 reject, 정확히 3회 호출.
- `options.maxAttempts: 5` → 5회 호출 후 reject (커스터마이징 동작).
- `fn`이 함수가 아니면 `TypeError`로 reject.

## 판단 (assumptions.md 요약)
- **3회 상한**(무제한 재시도=hang 방지) · 지수 백오프 200ms→2000ms 상한, 지터 없음 ·
  **reject=실패/resolve=성공**(status 분류 자료 부재) · `fn()` 인자 없음 · 총 대기 30s 2차 안전장치 ·
  최종 실패=마지막 오류 reject · `options`로 기본값 덮어쓰기 허용.

## 한계·미확인
- **"실패"를 Promise 결과로만 판정**: `fn`이 reject 대신 `{status:500}`를 *resolve*하는 스타일이라면 본 래퍼는 성공으로 여긴다. status 기반 분류를 원하면 AMBIG-03처럼 결과를 검사하는 분기가 필요하다(이래도 명세가 반환 형식을 안 줘 판단).
- 3회/200ms/2000ms/30s는 모두 **내가 정한 기본값**으로, 명세 근거가 아닌 선택. 운영에 맞춰 `options`로 재설정 필요.
- 멱등성(같은 호출 재시도로 중복 생성 방지)은 `fn`/서버 책임이라 래퍼에서 다루지 않았다.
- 토큰·속도·비용 노출 안 돼 null.

## 산출물
`retry.mjs`(구현) · `test.mjs`(5/5) · `assumptions.md`(판단 6항) · `RESULT.md`
