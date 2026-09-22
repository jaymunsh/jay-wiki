# AMBIG-03 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.5-character-1
- 입력: `input/ambig03-spec.md` (명세서 v2.3) · SHA-256 `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625`
- 입력 종류: `authored_spec_with_contradiction`
- 시작 (agent-observed): 2026-09-18T10:05:00Z (추정, 실시간 시계 측정 아님)
- 종료 (agent-observed): 2026-09-18T10:24:00Z (추정, 실시간 시계 측정 아님)
- 경과 (agent-observed): 약 19분
- 산출물: solution.mjs, solution.test.mjs, assumptions.md, RESULT.md
- 도구: node v24.18.0 (`node --check`, `node solution.test.mjs`), bash, `shasum -a 256`

## 입력 검증

- 입력 파일을 도구 작업 공간(`tool-workspace/ambig03-spec.md`)에 복제하고 `shasum -a 256`로 검증.
- 계산된 SHA-256 = `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625`
- `cases/v0.5-character/sources.json`의 `AMBIG03-SPEC` 해시와 **일치** → 입력 무결성 확보.

## 실행 방법

```bash
node --check outputs/AMBIG-03/solution.mjs   # 문법 검증
node outputs/AMBIG-03/solution.test.mjs       # 동작 검증 (9건)
```

`solution.mjs`는 단일 파일 ES 모듈(`.mjs`)이며 `node:` 내장 모듈을 사용하지 않는다. `fetchWithPolicy(call, options?)`를 export한다.

## 구현 요약

- `export async function fetchWithPolicy(call, options = {})` — `call()`을 호출하고 실패(throw/reject)하면 정책대로 재시도, 성공 시 반환값을 그대로 반환.
- **모순 해결**: 명세서 섹션3("최초 호출 포함 최대 3회 시도")과 섹션7("성공할 때까지 재시도")의 모순을 `assumptions.md`에 문서화하고, 여기서는 명시적 숫자 규칙인 섹션3을 우선한다. 섹션7의 "성공할 때까지"는 동일 섹션의 "대기 총합 5초 초과 중단"으로 제한해 해석.
- 기본 정책:
  - `maxAttempts=3`(첫 호출 포함 최대 3회, 섹션3)
  - `baseDelay=200`, `maxDelay=2000`, 지수 백오프 `min(200 * 2**(attempt-1), 2000)`, 지터 없음(섹션4)
  - `totalWaitCap=5000`(대기 총합 5초 초과 시 남은 횟수와 무관하게 중단, 섹션7)
  - `idempotencyKey` 제공 시 `call`의 인수로 전달(섹션5)
- 오류 분류 `classifyError`: 명시 `kind` 우선 → 429/5xx는 일시, 4xx(429 제외)는 영구, 상태 코드 없으면 일시(섹션2 용어).
- 영구 오류는 재시도 없이 즉시 throw.
- 관측: 각 실패 시 `retry.attempt`, 실제 대기 시 `retry.wait`, 최종 실패 시 `retry.exhausted` 이벤트 로깅(섹션6 + 확장).
- `onExhausted` 콜백: 최종 실패 시 한 번 호출.
- `sleep`/`now` 옵션으로 주입 가능(테스트 교체용, 기본 `setTimeout`/`Date.now`).
- `call`이 함수가 아니면 `TypeError`(재시도 안 함).

## 확인한 동작 (자체 검증)

`node outputs/AMBIG-03/solution.test.mjs` 실행 결과 **9건 전체 PASS** (fail 0).

- 첫 시도 성공 → 반환값 그대로 반환, `call` 1회 호출
- 일시 오류(503) 2회 후 성공 → 총 3회 호출(섹션3 최대 3회), 대기 `[200, 400]`(지수 백오프)
- 영구 오류(401) → 재시도 없이 즉시 실패, 1회 호출
- 영구 오류(400, 상태 코드만으로도 분류) → 즉시 실패, 1회 호출
- 429 → 일시로 재시도 후 성공
- 재시도 소진(3회) → 마지막 오류 `boom`을 throw하고 `retry.exhausted` 한 번 발생
- 멱등 키 `ord-123` 모든 호출에 전달
- 대기 총합 cap(450ms) 초과 → 2회 호출 후 중단(첫 호출 이후 초과 분은 대기 전 중단, 실제 대기 1회만 로깅 `[200]`)
- `call=null` → `TypeError`

## 판단 근거 (요약)

명세서의 의도적 모순과 세부 비움을 여섯 판단으로 채웠다. 세부 근거는 `assumptions.md`에 문서화:

1. **모순은 섹션3 우선** — 명시적 수치(최대 3회)가 일반 서술("성공할 때까지")보다 우선. 섹션7는 동일 섹션의 5초 캡으로 제한 해석.
2. **최대 3회**(첫 호출 포함) — 섹션3 명문 표현.
3. **오류 분류** — 섹션2 용어(429는 영구 제외→일시, 5xx→일시, 4xx→영구).
4. **지수 백오프** — 섹션4 그대로(200ms 시작, 2배, 상한 2000ms, 지터 없음).
5. **5초 캡** — 섹션7, 초과 분은 대기 전 중단.
6. **멍등키·관측·주입** — 섹션5/6 준수 및 관측성/테스트 용이성 확장.

## 확인하지 못한 사항

- **독립 채점 통과**: 위 9건은 자체 검증 통과일 뿐, 별도 채점 기준(정확성 40·판단 근거 문서화 30·경계 처리 20·코드 명료성 10)의 독립 통과를 의미하지 않는다.
- **모순 해결의 채점자 의도**: 섹션3 우선은 합리적 해석이지만, 채점자가 섹션7를 더 우선시할 가능성은 배제할 수 없다.
- **5초 캡 로깅 세부**(초기 초과 대기 미로깅)는 실무적 선택이지 섹션6의 강제 요구사항은 아니다.
- **실제 시계로 측한 소요 시간**: 추정치이며 외부 독립 계측이 아니다.
- **토큰/속도/비용**: 노출되지 않아 `null`/`not_exposed`.
- 실제 네트워크 단절·타임아웃 시뮬레이션은 `sleep` 주입으로 대체했다.
