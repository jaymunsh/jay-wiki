# RESULT — AMBIG-03 (재시도 정책 명세서 구현)

- case: AMBIG-03 · v0.5-character-1 (구간 3)
- model: splash/incoai/Qwen3.8-27B-Splash
- 고정 입력: `input/ambig03-spec.md` (v2.3). SHA-256 `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625` — sources.json(AMBIG03-SPEC)과 **일치**(사본 `outputs/AMBIG-03/ambig03-spec.md`).
- 시작: 2026-09-30T05:36Z / 종료: 2026-09-30T05:47Z / 경과: 약 11분
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 구현
`solution.mjs` → `export async function fetchWithPolicy(fn)`.
`test.mjs` → node:test 6개. **6/6 통과** (`node --test AMBIG-03/test.mjs`).

## 확인한 동작 (테스트로 검증)
- 첫 성공(200) → 즉시 반환, 1회 호출.
- 500→성공 → 2회.
- **4회차에야 성공하는 fn → 정확히 3회에서 중단 후 throw**(§3 상한이 §7 "성공할 때까지"를 이긴 것) — 핵심 검증.
- 401 → 즉시 throw, 1회(영구, 재시도 없음).
- 429 → 임시로 처리해 재시도(3회).
- resolve된 5xx → 실패로 취급해 재시도(3회).

## 모순 해석 (assumptions.md §1)
- §3 "최초 포함 최대 3회" vs §7 "성공할 때까지" → **§3 수치 상한 우선**.
- 근거: 구체적 hard cap이 개요적 "until success"보다 우세 / 무한 재시도는 위험 / §1·§5가 멱등·비용 민감한 결제 게이트웨이 문맥.
- "성공할 때까지"를 "(상한 안에서) 성공할 때까지"로 한정. 총 대기 5초(§7)는 3회(≤600ms)에선 2차 방어(실제 발동 없음).

## 한계·미확인
- **`fn`의 status shape은 가정**이다. 실제 게이트웨이가 status를 `.status` 말고 `.code`/응답체로 주면 분류가 달라진다. §2가 HTTP 응답을 전제하므로 status 기반 분류를 택했고, AMBIG-02(Promise 결과만)와 의도적으로 구별.
- 429를 "일시"로, 한도초과는 "영구"로 — 명세 §2 그대로. "한도 초과"의 구체적 신호(status/코드)가 명세에 없어, 코드에선 401/403/기타4xx=영구로만 구분(429 제외).
- §8 정산 배치 제외 조항은 이 함수 범위 밖이라 미구현(의도적).
- 토큰·속도·비용 노출 안 돼 null.

## 산출물
`solution.mjs`(구현) · `test.mjs`(6/6) · `assumptions.md`(판단 5항+모순 해석) · `ambig03-spec.md`(입력 사본, 해시 검증) · `RESULT.md`
