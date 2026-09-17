# GAME-01 RESULT — 보관(Hold) 기능이 있는 테트리스

## 제출물

- `outputs/GAME-01/index.html` — 단일 파일, 외부 의존성 0건 (24,631 bytes)
- 검증 기록: `browser-check.json`(33항목), `real-key-play.json`(실제 키 플레이), `screenshots/*.png`(4장)
- 검증 스크립트: `tool-workspace/browser/game01-check.mjs`, `game01-play.mjs`

## 구현 요약

| 요구 | 구현 |
|---|---|
| 보드 10×20 | `COLS=10, ROWS=20`, 셀 30px 캔버스 |
| 블록 7종 | I, O, T, S, Z, J, L (7-bag 무작위) |
| 이동·회전·낙하 | ← → 이동, ↑/X 시계 방향 회전, ↓ 소프트 드롭, Space 즉시 낙하 |
| 회전 취소 | 회전 결과가 벽을 벗어나거나 기존 블록과 겹치면 회전을 **취소**(벽차기 없음) |
| 줄 제거·점수 | 동시 제거, 1·2·3·4줄 = 100·300·500·800점. 낙하 자체에는 점수 없음 |
| 다음·보관·점수·일시정지·게임오버·재시작 | 모두 UI로 제공 (P/ESC 일시정지, R 재시작) |
| Hold 키 | **C와 Shift 모두** 동작 |
| 빈 슬롯 Hold | 현재 블록을 슬롯에 넣고 대기열에서 다음 블록을 가져옴 |
| 슬롯이 찬 경우 | 서로 교환하고 **대기열은 유지** |
| Hold 1회 제한 | `holdUsed` 플래그. 활성 블록이 고정될 때 해제 |
| 우회 방지 | `e.repeat` 무시 + 플래그 기반이라 키 연타·키 유지·C/Shift 교차 모두 차단 |
| 보관 복귀 | `makePiece()`로 기본 회전(rot 0)·기본 생성 위치로 복귀 |
| 생성 위치 충돌 | 충돌 시 게임오버 |
| Hold 무부작용 | Hold 경로가 점수·보드·줄을 건드리지 않음 |
| 일시정지·게임오버 | Hold 차단 |
| 재시작 | 보드·점수·줄·보관 슬롯·사용 제한 초기화. `requestAnimationFrame` 루프는 최초 1회만 생성 |
| 낙하 속도 | `max(100, 800 - (level-1)*70)` ms, level = `floor(lines/10)+1` |

## 검증 방법

- 로컬 설치된 Google Chrome을 `--headless=new` + CDP로 직접 구동(전역 설치·외부 패키지 없음). 드라이버는 Node 22 내장 `WebSocket`·`fetch`만 사용.
- **실제 키 입력**: `Input.dispatchKeyEvent`로 실제 keydown/keyup을 페이지에 전달. 이동·회전·즉시 낙하·Hold는 주입 API가 아니라 실제 키로 검증했다.
- **테스트 주입 API**: 결정적 검증을 위해 `window.__tetrisTest`를 별도로 두었다(아래 참고).

### 검증 결과: 33개 항목 전부 통과

```json
{"total": 33, "passed": 33, "failed": 0}
console errors: []
exceptions: []
```

### Hold 관련 검증 항목 (전부 통과)

| 항목 | 실측 결과 |
|---|---|
| Hold(빈 슬롯) | hold=`I`, 활성 블록이 대기열 첫 블록(`T`)으로 교체, 대기열이 한 칸 전진 |
| Hold(슬롯 참) | hold=`I`, 활성 블록 `O`, 대기열 완전 동일 |
| 보관 복귀 | 활성 블록 `O`가 rot 0, x=4, y=0 — 기본 생성 위치와 일치 |
| Hold 후 2차 Hold 거부 | 1차 `true`, 2차 `false`, 슬롯·활성 블록 변화 없음 |
| 실제 키 C 연타 | 3회 연속 입력에도 슬롯·활성 블록 불변 |
| 키 유지(repeat) | `autoRepeat:true` keydown 2회에도 Hold 미발동 |
| C → Shift 교차 | Shift 입력이 차단됨(holdUsed 유지) |
| Shift 단독 | 정상 Hold 동작 |
| 고정 후 제한 해제 | hardDrop으로 고정 뒤 `holdUsed === false` |
| Hold 무부작용 | Hold 2회 후에도 score·lines·board 완전 동일 |
| 일시정지 중 Hold | 반환 `false`, 슬롯 `null` 유지 |
| 게임오버 중 Hold | 반환 `false`, 슬롯 `null` 유지 |
| 생성 위치 충돌 | 게임오버 전이, 활성 블록 `null`, 오버레이 “게임 오버” 표시 |
| 재시작 | score 0, lines 0, hold null, holdUsed false, 보드 전부 비어 있음 |
| 반복 재시작 6회 | 낙하 간격 `[800,800,800,800,800,800]` — 속도 중복 증가 없음 |
| 게임 루프 | `loopStarts` 6회 재시작 후에도 1 — 루프 중복 생성 없음 |

### 그 밖의 실측 결과

- 줄 제거 점수: 1줄 +100, 2줄 +300, 3줄 +500, 4줄 +800 (동시 제거 확인).
- 회전 취소: 벽(`L` rot3 x=8 → rot0은 x+2=10으로 벗어남)에서 `false`, 블록(`T` rot0 x=3, (4,2)에 블록)에서 `false`.
- 중력: 레벨 1에서 800ms당 1칸. 일시정지 중에는 5000ms를 진행해도 낙하 없음.
- HUD: 점수·줄·낙하 간격 텍스트가 내부 상태와 일치.
- 외부 자원: `performance.getEntriesByType('resource')` 0건.

### 실제 키만으로 플레이한 세션 (`real-key-play.json`)

테스트 주입 API를 쓰지 않고 실제 키 입력만으로 진행:

- 블록 13개 배치, Hold 5회 사용(키 C 3회 + Shift 2회)
- 보드에 52칸 고정, 이후 적재로 게임오버 → 오버레이 표시
- R 키로 재시작 → 점수 0, 줄 0, 보드 0칸, 보관 슬롯 비어 있음, `loopStarts` 1
- 콘솔 오류 0건

## 테스트 전용 상태 주입 기능 (일반 플레이와 분리)

일반 플레이 경로는 키 입력만 받는다. 검증을 위해 아래를 **별도 네임스페이스**로 두었고, 게임 규칙을 우회하지 않는다.

- `window.__tetrisTest.snapshot()` — 읽기 전용 상태 조회
- `window.__tetrisTest.freeze(bool)` — 실시간 루프의 시간 진행을 멈춤(결정적 검증용)
- `window.__tetrisTest.step(ms)` — 게임 시간을 지정량 진행
- `window.__tetrisTest.setQueue / setHold / setHoldUsed / setBoard / clearBoard / setActive`
- `window.__tetrisTest.hold() / action(name) / setPaused / setGameOver / lockActive`

이 API가 없어도 게임은 동일하게 동작한다. 실제 키 입력 검증과 실제 키 플레이 세션은 이 API 없이도 통과했다(Hold 5회 포함).

## 확인하지 못한 부분

- 사람이 직접 오래 플레이한 체감 난이도·조작감은 확인하지 않았다. 자동 입력과 프로그램적 검증만 수행했다.
- 락 딜레이(바닥에서 이동 유예)는 구현하지 않았다. 바닥에 닿으면 즉시 고정된다. 이는 문제 요구에 없어 의도적으로 단순화한 설계다.
- 점수 체계에서 레벨별 배수·콤보·백투백은 요구에 없어 구현하지 않았다.
- Safari·Firefox 렌더링은 확인하지 않았다(Chrome만 사용).
- 스크린샷은 headless 렌더링 결과다.

## 시간 기록

- 시작(UTC): 2026-09-13T14:37:09Z, 종료(UTC): 2026-09-13T14:44:18Z (agent-observed, `date -u`)
- 관측 소요: 429,000 ms (7분 9초). 한도 25분 이내.
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 수정 이력

- 최초 작성 후 검증 중 초기화 순서 결함 발견: `createState()`가 `state` 전역 할당 전에 `refillQueue()`를 호출해 초기화가 중단됐다. `refillQueue(target)`가 대상 상태를 인자로 받도록 수정했다. 수정 후 33개 항목 전부 통과.

## 검증

- 검증 방식: 브라우저 실제 조작(headless Chrome + CDP, 실제 키 입력) + 소스 점검 + 스크린샷. 자기 채점 없음. 상태: submitted.
