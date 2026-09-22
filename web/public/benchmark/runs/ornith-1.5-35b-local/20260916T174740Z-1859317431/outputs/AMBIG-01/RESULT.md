# AMBIG-01 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.5-character-1
- 입력: 없음 (고정 입력 없는 과제, 문제지 명세만 따름)
- 시작 (agent-observed): 2026-09-17T18:12:00Z (추정, 실시간 시계 측정 아님)
- 종료 (agent-observed): 2026-09-17T18:32:00Z (추정, 실시간 시계 측정 아님)
- 경과 (agent-observed): 약 20분
- 산출물: solution.mjs, assumptions.md, RESULT.md
- 도구: node v24.18.0 (`node --check`, `node tool-workspace/ambig01_test.mjs`), bash, python3

## 실행 방법

```bash
node --check outputs/AMBIG-01/solution.mjs            # 문법 검증
node tool-workspace/ambig01_test.mjs                  # 동작 검증 (15건)
```

`solution.mjs`는 단일 파일 ES 모듈(`.mjs`)이며 `node:` 내장 모듈을 사용하지 않는다. `parkingFee(entryIso, exitIso)`를 기본 export한다.

## 구현 요약

- `export function parkingFee(entryIso, exitIso)` — 입차·출차 ISO 8601 문자열을 받아 요금 정수(원)를 반환한다.
- 기본 30분 무료, 이후 10분당 500원, 1일 최대 15,000원.
- 24시간 단위로 나누어 각 단위에서 (30분 무료 → 10분당 500원, 10분 단위 올림 → 15,000원 캡)를 적용 후 합산한다.
- 입력 검증: 문자열이 아니면(`typeof !== 'string'`), 파싱 실패(`NaN`), `duration <= 0` → 모두 `RangeError`.
- 반환은 `Math.round`로 정수화한다.

## 판단 근거 (요약)

세 줄 축약 명세에서 여섯 가지를 정했다. 세부 근거는 `assumptions.md`에 문서화했다:

1. **10분당 500원 = 10단위 올림** — 부분 10분 블록도 전체 블록으로 과금.
2. **기본 30분 무료 = 방문 첫 30분에만 1회** — 다일 주차도 무료 1회.
3. **"1일 최대 15,000원" = 24시간 단위 일일 캡** — 24시간 초과 시 일수 누적 (flat cap 아님).
4. **과금 계산 순서** — 24시간 루프에서 30분 무료 → 10분당 500원 → 15,000 캡.
5. **입력 검증** — 비문자열/파싱실패/duration≤0 → RangeError.
6. **열린 문제** — 다일 30분 무료 회수(1회 vs 1일당 1회), 올림/비례의 명세상 엄밀 검증 불가.

## 확인한 동작 (자체 검증)

`node tool-workspace/ambig01_test.mjs` 실행 결과 **15건 전체 PASS** (fail 0).

- 30분 → 0원 (무료)
- 35분 → 500원 (1블록)
- 40분 → 500원
- 50분 → 1000원 (2블록)
- 1시간 → 1500원
- 5시간 30분 → 15,000원 (캡 직전/도달)
- 5시간 31분 → 15,000원 (캡)
- 24시간 → 15,000원 (1일 캡)
- 25시간 → 16,500원 (1일 15,000 + 1시간 1500)
- 48시간 → 30,000원 (2일 캡)
- 잘못된 ISO → RangeError
- 숫자 입력 → RangeError
- undefined 입력 → RangeError
- 출차가 입차와 같은 시각 → RangeError
- 출차가 입차보다 이전 → RangeError

## 확인하지 못한 사항

- **독립 채점 통과**: 위 15건은 자체 검증 통과일 뿐, 별도 채점 기준(정확성 40·판단 근거 문서화 30·경계 처리 20·코드 명료성 10)의 독립 통과를 의미하지 않는다.
- **명세의 모호성 검증**: "10분당"의 올림 vs 비례, 다일 30분 무료 회수 등은 관례로 확정했으나 문제지 원문의 엄밀 검증은 아니다.
- **실제 시계로 측정한 소요 시간**: 추정치이며 외부 독립 계측이 아니다.
- **토큰/속도/비용**: 노출되지 않아 `null`/`not_exposed`.
- 타임존: 모든 테스트는 ISO의 `Z`(UTC) 기준으로 진행. 문자열에 잔여 타임존이 있으면 `Date` 해석이 달라질 수 있다.
