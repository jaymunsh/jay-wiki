# AMBIG-02 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.5-character-1
- 입력: 없음 (고정 입력 없는 과제, 문제지 명세만 따름)
- 시작 (agent-observed): 2026-09-18T09:45:00Z (추정, 실시간 시계 측정 아님)
- 종료 (agent-observed): 2026-09-18T10:02:00Z (추정, 실시간 시계 측정 아님)
- 경과 (agent-observed): 약 17분
- 산출물: retry.mjs, assumptions.md, RESULT.md
- 도구: node v24.18.0 (`node --check`, `node retry.test.mjs`), bash

## 실행 방법

```bash
node --check outputs/AMBIG-02/retry.mjs   # 문법 검증
node outputs/AMBIG-02/retry.test.mjs      # 동작 검증 (6건)
```

`retry.mjs`는 단일 파일 ES 모듈(`.mjs`)이며 `node:` 내장 모듈을 사용하지 않는다. `callWithRetry(fn, options?)`를 기본 export한다.

## 구현 요약

- `export async function callWithRetry(fn, options = {})` — `fn`을 호출하고 실패하면 재시도한다.
- 기본 정책: `retries=3`(초기 호출 이후 최대 3회 재시도 → 총 4회 시도), `delayMs=0`(기본 대기 없음), `backoff='fixed'`.
- 성공 시 `fn`의 반환값을 `await`해 그대로 반환.
- 재시도 전 `onRetry({ attempt, maxRetries, error, waitMs })` 콜백 호출(기본 `null`).
- `fixed`/`exponential` 백오프 지원(exponential: `delayMs * 2 ** attempt`).
- 모든 재시도 횟수 소진 시 마지막 오류(`lastError`)를 throw.
- `fn`이 함수가 아니면 `TypeError`(재시도 안 함).
- `sleep` 옵션으로 대기 구현 주입 가능(테스트 교체용, 기본 `setTimeout`).

## 판단 근거 (요약)

빈 명세를 여섯 판단으로 채웠다. 세부 근거는 `assumptions.md`에 문서화했다:

1. **재시도 횟수 기본 3** — "초기 호출 이후 재시도 횟수"로 해석(총 4회 시도). 관례 기반.
2. **대기 기본 0** — 문제지에 대기 지정이 없어 인위적 대기를 끼워 넣지 않음. 옵션으로 제공.
3. **백오프 fixed/exponential** — 지정 없어 기본 fixed, exponential은 선택 가능.
4. **throw되는 모든 오류를 재시도** — 문제지 정책이 일반적("실패하면 재시도"). 일시/영구 미구분(이 과제 범위 벗어남).
5. **마지막 오류 던지기** — 재시도 소진 후 마지막 `lastError`를 그대로 throw.
6. **onRetry + sleep 주입** — 관측성과 테스트 용이성을 위해 제공(강제 안 함).

## 확인한 동작 (자체 검증)

`node outputs/AMBIG-02/retry.test.mjs` 실행 결과 **6건 전체 PASS** (fail 0).

- 첫 시도 성공 → 반환값 그대로 반환, `fn` 1회 호출, `onRetry` 미호출
- 실패 2회 후 성공 → 총 3회 호출, `onRetry` 2회 호출(attempt 1, 2)
- 재시도 소진 → 마지막 오류 `final`을 throw, `fn` 3회 호출(retries=2)
- 지수 백오프 대기 계산 → `[100, 200, 400]` (retries=3, delayMs=100)
- 고정 백오프 대기 계산 → `[50, 50]` (retries=2, delayMs=50)
- `fn=null` → `TypeError`

## 확인하지 못한 사항

- **독립 채점 통과**: 위 6건은 자체 검증 통과일 뿐, 별도 채점 기준(정확성 40·판단 근거 문서화 30·경계 처리 20·코드 명료성 10)의 독립 통과를 의미하지 않는다.
- **재시도 횟수 해석**: "초기 이후 vs 총 횟수"는 관례로 확정했으나 명세 원문 검증은 아니다.
- **대기 기본값 0**의 실무 적합성(붐 효과)은 호출자 책임으로 넘겼다.
- **실제 시계로 측정한 소요 시간**: 추정치이며 외부 독립 계측이 아니다.
- **토큰/속도/비용**: 노출되지 않아 `null`/`not_exposed`.
- 재시도 간 실제 네트워크 지연·타임아웃 시나리오 시뮬레이션하지 않았다(`sleep` 주입으로 대체).
