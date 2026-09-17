# GAME-01 RESULT

- 상태: submitted
- 시작(UTC, agent-observed): 2026-09-13T14:34:00Z
- 종료(UTC, agent-observed): 2026-09-13T14:40:32Z
- 경과: 약 6분 32초 (측정 출처: macOS `date -u`)

## 산출물

- `index.html` — 외부 의존성 없는 단일 파일. 10×20 보드, 7종 블록, 좌우 이동·시계 방향 회전(↑/X)·빠른 낙하(↓)·즉시 낙하(Space), 일시정지(P), 재시작(Enter/R).
- `shot.png` — headless Chrome 렌더 캡처.
- `verify-output.txt` — 상호작용 검증 로그 15건 전부 PASS (puppeteer-core + 시스템 Chrome).

## 확인한 동작 (Chrome headless, 실제 키 이벤트)

- 보관(C/Shift 모두 동작): 빈 슬롯은 현재 블록 보관 후 대기열에서 다음 블록 생성.
- 슬롯이 차 있으면 현재↔보관 교환, 대기열(next) 유지.
- 고정 전 재보관 차단: C·Shift 연타·교차 입력 모두 `canHold`로 차단.
- 회전된 상태로 보관해도 꺼낼 때 기본 회전·생성 위치(3,0)로 복귀.
- 보관만으로 점수·보드·제거 줄 수 불변.
- 일시정지·게임오버 중 보관 차단.
- 벽에 겹치는 회전 취소(벽차기 없음).
- 1줄 제거 +100점·줄 수 카운트(2·3·4줄은 300·500·800으로 코드상 구현, 자동 검증은 1줄 사례).
- 생성 위치 충돌 시 게임오버.
- 재시작 시 보드·점수·보관 슬롯·canHold·루프 초기화. 재시작 3회 후 1.5초간 낙하 dy=2로 루프 중복 없음 확인.

## 검증용 상태 주입 기능 (일반 플레이와 분리)

- `window.__tetris.state`: 읽기 전용 스냅샷.
- `window.__tetris.debug.setGrid/setCurrent/setBag`: 자동 검사용 상태 주입. 플레이어 입력과 무관하며 RESULT.md에 문서화.
- 검증 스크립트: `tool-workspace/game01-verify/verify.mjs`.

## 미측정

- 사람이 직접 창에서 플레이한 검증은 아님(headless 자동 조작).
- 토큰·비용·첫 토큰 시간: 플랫폼 미제공(not_exposed).
