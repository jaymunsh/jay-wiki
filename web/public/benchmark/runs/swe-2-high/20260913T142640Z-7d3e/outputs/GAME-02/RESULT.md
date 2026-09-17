# GAME-02 RESULT

- 상태: submitted
- 시작(UTC, agent-observed): 2026-09-13T14:41:11Z
- 종료(UTC, agent-observed): 2026-09-13T14:48:01Z
- 경과: 약 6분 50초 (측정 출처: macOS `date -u`)

## 산출물

- `index.html` — 외부 의존성 없는 단일 파일, 캔버스·자체 도형.
- `verify-output.txt` — headless Chrome(puppeteer-core) 검증 11건 전부 PASS.
- `shot.png` — 캡처.

## 사용한 물리 수치

- 중력 1500 px/s², 이동 속도 240 px/s, 점프 초속 -560 px/s, 밟기 반동 -430 px/s
- dt 상한 0.033s, 추락 판정 y>640, 카메라는 플레이어 중심·[0, 1600] 클램프
- 점프 체공 ≈0.75s·수평 도달 ≈180px → 두 틈(130px, 140px) 통과 가능

## 확인한 동작 (headless Chrome, debug.step으로 결정적 구동)

- 공중 점프 불가 / 지면 점프만 동작.
- 코인 1회 획득(중복 획득 없음).
- 카메라 양 끝 클램프(x=0 → camX 0, x=2360 → camX 1600).
- 플랫폼 아래에서 머리 충돌(y=430, vy=0).
- 적 위에서 밟기: 적 소멸 + 반동 점프 / 옆 충돌: 실패.
- 틈 추락 실패, 실패 후 재시작으로 위치·속도·코인·적·시간 초기화.
- 골 도달 시 클리어 표시와 진행 시간 정지.
- **완주 검증**: 키 이벤트 주입 + debug.step으로 실제 게임 루프를 구동해 시작점부터 골까지 완주 — 550스텝(약 9.2초 게임 시간), 점프 4회, status=clear 확인. 사람이 직접 플레이한 것은 아님.

## 개발 중 수정한 결함

- `overlaps()`가 `player.w/h`를 읽으나 player 객체에 속성이 없어 모든 충돌이 무력화되던 것을 검증 과정에서 발견·수정.

## 검증용 상태 주입 (일반 플레이와 분리)

- `window.__game.state`(읽기 스냅샷), `__game.debug.setPlayer/step/pause/resume`. RESULT.md에 문서화. 검증 스크립트는 `tool-workspace/game02-verify/verify.mjs`.

## 미측정

- 토큰·비용·첫 토큰 시간: 플랫폼 미제공(not_exposed).
