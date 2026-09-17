# 시나리오 다듬기 인수인계

작성일: 2026-08-03
목적: 세션이 바뀌어도 이 작업을 이어갈 수 있게, 대화에만 있던 판단과 상태를 남긴다.

> 이 문서는 2026-08-03 당시의 인수인계 기록이다. 작업은 이후 `main`에 반영됐고,
> 현재 운영 배포·콘텐츠 수치는 [current-project-status.md](./current-project-status.md)를 기준으로 한다.

## 새 세션에서 이어받는 법

이 문서를 지목하고 이렇게 말하면 된다.

> `docs/scenarios-polish-handoff.md` 읽고 이어서 진행해.

**둘 다 2026-08-03에 처리했다.** 아래 "처리 결과"를 먼저 읽는다.

1. ~~`/scenarios/[id]` 서사 페이지를 화면으로 확인~~ → 그 페이지는 **도달하지 않는다.** 아래 참고
2. ~~`domainScenarioConfigs.ts` 의 데모 화면 문구 15편 다듬기~~ → 완료

## 처리 결과 (2026-08-03)

### `ScenarioNarrativePage` 는 죽은 코드다

`web/src/app/scenarios/[id]/page.tsx:52` 가 `INTEGRATED_CONFIGS` 에 slug 가 있으면
`DomainScenarioWorkbench` 를 먼저 반환한다. `ScenarioNarrativePage` 로 가는 분기는
`route === '/scenarios/{id}'` 인 시나리오만 통과하는데, **그 조건을 만족하는 11편이 전부
`INTEGRATED_CONFIGS` 에 들어 있다.** 그래서 그 컴포넌트는 한 번도 안 그려진다.

즉 `/scenarios/commerce-order-confirmation` 에서 보이는 건 서사 페이지가 아니라 **데모 랩**이다.
남은 일 1과 2가 사실 같은 화면이었다. 지울지 살릴지는 결정하지 않고 남겨 뒀다.

### 데모 문구 15편 — 파일이 **둘**이었다

`domainScenarioConfigs.ts` 만 고치면 끝이 아니다. 랩 화면의 **첫 문단**은 거기서 안 온다.

| 파일 | 무엇 |
|---|---|
| `domainScenarioConfigs.ts` | `summary` · `modes[].description` · `principles` · `checklist` |
| `DomainScenarioWorkbench.tsx` | `EXAMPLE CASE` / `RECONSTRUCTED CASE` 블록 — 인라인 4 + `OperationalContext` 4 + `PracticeContext` 7 |

두 번째를 빠뜨리면 **한 화면 안에서** 문체가 끊긴다. 제목 바로 아래 첫 문단만 옛 톤으로 남기 때문이다.
둘 다 21편 톤으로 다시 썼다. `docs/interview/` 의 원리를 근거로 삼았고,
진위 고지 문장은 넣지 않았다(배지와 캡션이 한다).

`DomainScenarioWorkbench.tsx` 의 `EXAMPLE CASE` 는 **JSX 본문**이라 큰따옴표를 그대로 쓰면
`react/no-unescaped-entities` 로 **빌드가 깨진다**. `&quot;` 로 escape 한다.
(`OperationalContext`·`PracticeContext` 는 JS 문자열이라 그냥 써도 된다.)

**배치는 수치로 확인했다.** 스크린샷은 못 찍었다 — Orca 창이 두 번째 디스플레이에 있어
`orca screenshot` 이 "tab may not be visible" 로 타임아웃한다. 대신 15편 × 3폭을 훑었다.

| 폭 | 결과 |
|---|---|
| 1431px | 전부 한 줄(사례 본문만 두 줄). 넘침 0 |
| 744px | 두 줄. 모드 카드 높이 78px 로 균일 |
| 413px | 모드가 1열로 스택. 잘림 없음, 가로 스크롤 0 |

세 폭 모두 사례 블록 `scrollHeight - clientHeight` 가 0이고 문서 가로 스크롤도 0이다.

`business-metrics` 의 `EXPORT_RECONCILIATION` 한 줄만 다른 모드보다 길어서 행 높이가
튀었고(68→79px), 짧게 줄여 맞췄다. **모드 설명은 데스크톱에서 한 줄에 들어가는 길이로
맞춘다** — 하나만 넘치면 2열 격자의 그 행 전체가 같이 커진다.

`commerce-order-confirmation` 등에서 744px 일 때 `partner-production-table` 이 37px 넘치는데,
`OrderImplementationEvidence.tsx` 의 표라서 이번 변경과 무관하다. 문서 전체 가로 스크롤은 0이다.

---

## 지금 어디까지 왔나

브랜치 `docs/interview-scenarios` — **커밋 13개, origin 에 push 완료.**
아직 `main` 이 아니므로 **운영 사이트는 여전히 예전 화면이다.**

PR: https://github.com/jaymunsh/jay-wiki/pull/new/docs/interview-scenarios

| 갈래 | 내용 | 상태 |
|---|---|---|
| 면접 문서 | `docs/interview/` 21편 (약 6,500줄) | 완료 |
| 위키 원본 삭제 | 8편 삭제, 색인 49→41 검증 | 완료 |
| 백엔드 결함 4건 | Saga 트랜잭션 경계 · 채팅 Lua · Outbox 선점 · KEYS→SCAN | 완료 |
| 진위 2축 배지 | 출처(3) × 실행(2), 범례, 상태등 디자인 | 완료 |
| 목록·상세 문구 | `scenarios.ts` 21편 전부 | 완료 |
| 데모 화면 문구 | `domainScenarioConfigs.ts` 15편 | 완료 |
| 서사 페이지 확인 | `/scenarios/[id]` | 완료(도달 안 하는 코드로 판명) |

## 배경 — 데모 화면 문구를 왜 고쳤나

### 왜 필요했나

`/scenarios` 쪽은 전부 다듬었는데, **데모 화면은 자기 문구를 따로 갖고 있었다.**
그래서 들어갈수록 문체가 끊겼다.

```
/scenarios 목록      "읽고 판단하고 쓰는 사이에 남이 끼어들면? 갱신이 덮어써져…"   ← 새 톤
  → 사례 자세히 보기   (같은 데이터라 새 톤)
    → 주문 확정 리허설  "상태 전이와 보상 경계를 비교한다"                        ← 예전 톤
```

### 대상 파일

`web/src/app/domain-scenarios/domainScenarioConfigs.ts` (312줄, 랩 15개)

고칠 필드:

| 필드 | 개수 | 성격 |
|---|---|---|
| `summary` | 15 | 화면 상단 한 줄 |
| `modes[].description` | 랩당 4~6 | 실행 모드 버튼 설명 |
| `principles[].title/detail` | 랩당 3 | 원칙 카드 |
| `checklist` | 랩당 3 | 실무 재확인 조건 |

### 다듬는 원칙 (21편에 적용한 것과 같다)

1. **압축된 명사구를 풀어쓴다** — "조회와 차감을 분리해 무조건 처리하면" → "각자 차감하면"
2. **왜 그런 일이 생기는지를 넣는다** — `docs/interview/` 21편의 원리 설명을 짧게 이식
3. **구체적인 숫자와 장면으로 말한다** — "실제 판매 가능한 수량은 한 개" → "재고가 1개 남았고 두 고객이 거의 같은 순간에"
4. **진위 고지 문장은 넣지 않는다** — 배지와 캡션이 이미 한다

**`docs/interview/` 의 해당 편을 먼저 읽고 쓰면 훨씬 빠르다.** 거기에 원리가 다 정리돼 있다.

### 랩 15개와 대응 문서

| slug | 문서 |
|---|---|
| `gift-card` `order-confirmation` `coupon-race` `settlement-batch` | `01-거래-정합성.md` |
| `partner-api` | `02-분산-연동.md` |
| `traffic-burst` `connection-pool` `n-plus-one` `image-upload-pipeline` | `03-성능-데이터.md` |
| `data-correction` `privacy-lifecycle` `spreadsheet-operations` `business-metrics` `notification-delivery` `maintenance-mode` | `05-운영-거버넌스.md` |

---

## 반드시 알고 있어야 할 것

### 화면은 반드시 눈으로 본다

**웹은 자동 테스트로 화면을 못 잡는다.** vitest 가 node 환경이라 DOM 이 없다.
순수 함수만 테스트로 고정돼 있고 나머지는 봐야 안다.

이번에도 **화면을 보고서야 잡은 것이 다섯 건**이다 — 배지 설명 중복, 카드 하단 정렬 깨짐,
막대가 라벨보다 길어짐, 상세 패널 두 줄 어긋남, 링크 중복.

### 브라우저는 Orca 내장 브라우저를 쓴다

```bash
orca tab create --url "http://localhost:3000/scenarios" --json
orca screenshot --json        # 뷰포트
orca full-screenshot --json   # 전체 (길면 타일처럼 반복돼 보일 수 있다)
orca eval --expression "<js>" --json     # --code 가 아니라 --expression 이다
```

**React 상태는 같은 eval 안에서 갱신되지 않는다.** 카드를 클릭하고 결과를 읽으려면
eval 을 나누고 사이에 `sleep 2` 를 넣어야 한다. 한 번에 하면 전부 이전 상태를 읽는다.

**폭이 다른 화면을 확인하려면 측정한다.** 내 뷰포트는 사용자보다 좁다. 줄바꿈을 확인할 때는
임시로 폭을 키우고 `Range.getClientRects().length` 로 줄 수를 세면 정확하다.

```js
var el = document.querySelector('.scenario-legend');
el.style.width='1900px';
var r = document.createRange(); r.selectNodeContents(dd);
r.getClientRects().length   // 줄 수
```

### CSS 명시도 함정 — 이번에 두 번 당했다

`scenarios.css` 는 뒤쪽에 `.scenario-provenance[data-compact]` 같은 규칙이 몰려 있다.
앞에서 같은 명시도로 덮으려 하면 **뒤가 이긴다.**

- 상태 배지가 헤더 줄보다 16px 아래로 내려갔던 것
- 카드 하단 고정이 안 걸렸던 것

둘 다 이 이유다. 앞쪽에서 규칙을 쓸 때는 **한 단계 더 좁혀 잡아야** 한다.

### border-left 는 요소 높이를 따라간다

배지에 `padding-top` 을 주면 **막대만 글자보다 길어진다.** 간격은 위 형제의 `margin-bottom`
으로 준다. 파일 안에 주석으로 적어 뒀는데도 한 번 어겼다.

### 진위 배지는 축이 둘이다

`ScenarioProvenance` (출처)와 `ScenarioExecution` (실행)은 **다른 축**이다.
출처는 분류라서 세로 막대, 실행은 상태라서 상태등(점)이다. 형태가 갈려야 구별된다.

- 라벨은 전부 네 글자 또는 `LIVE`/`MOCK`. 길이가 들쭉날쭉하면 격자가 지저분해진다
- 뜻은 목록 상단 `ScenarioBadgeLegend` 가 진다. 배지는 표식이고 설명은 범례의 일이다
- 값과 설명은 `scenarios.ts` 한 곳에서 나온다. 배지를 늘리면 범례도 자동으로 따라온다

### 실제로 도는 것은 7편뿐이다

`DomainScenarioController` 는 `partner-api` 하나만 실제 서비스로 보내고,
나머지 14편은 `DomainScenarioEngine` 의 하드코딩 step 을 돌려준다.
`docs/interview/README.md` 의 진위 지도가 정본이다.

**대본 편의 숫자는 측정값이 아니다.** 지우지 않고 캡션으로 성격을 밝히는 쪽을 택했다 —
숫자를 없애면 모드 비교라는 화면의 목적이 사라지기 때문이다.

## 로컬 실행

```bash
pkill -f "next-server"; pkill -f "next dev"; sleep 2
lsof -ti :3000                      # 비어 있어야 한다
cd web && rm -rf .next && npm run dev
```

**dev 서버를 여러 개 띄우지 말 것.** 삭제된 `.next` 를 서빙해 CSS 가 통째로 빠져 보인다.
**`npm run build` 를 dev 가 떠 있는 채로 돌리지 말 것.** 같은 증상이 난다.

## 검증 기준선

```bash
cd web && npx tsc --noEmit          # 통과
cd web && npm run lint              # 경고 정확히 8개 (--max-warnings 8, 하나만 늘어도 빌드가 깨진다)
cd web && npm test                  # 61개
cd spring && ./gradlew test # 166개 (docker 필요: pf-postgres, pf-redis, pf-opensearch)
```

## 남겨 둔 것

- **배포 안 함.** 이 브랜치는 아직 `main` 이 아니다. 머지해야 파이프라인이 돈다
- **마이그레이션이 하나 들어간다** — `V16__outbox_claim.sql` 이 `tb_outbox_event` 에
  `claimed_at` 과 부분 인덱스를 추가한다. Flyway 가 자동으로 돌지만 배포 전 백업 시점은 확인한다
- **코드 결함 3건이 남아 있다** — 서킷 브레이커 미구현, `PartnerCallbackRegistry` 가 JVM 메모리,
  중단된 saga 복구 절차 없음. 셋 다 `docs/interview/` 에 정직하게 적혀 있어 면접에서는 먼저 말할 수 있다
- **3단계 실제 구현 승격은 안 했다** — JPA N+1 → 선착순 쿠폰 → 커넥션 풀 순서를 권한다.
  N+1 이 가장 싸고 면접 효용이 크다. `docs/interview/README.md` 참고

## 관련 문서

| 문서 | 내용 |
|---|---|
| [docs/interview/README.md](./interview/README.md) | 21편 색인 · 진위 지도 · 2단계 반영 기록 |
| [docs/interview/01~05](./interview/) | 편당 원리·대안·구두답변. **데모 문구 쓸 때 먼저 읽는다** |
| [docs/blog-work-handoff.md](./blog-work-handoff.md) | 앞 라운드(블로그). 이 작업은 거기서 이어졌다 |
