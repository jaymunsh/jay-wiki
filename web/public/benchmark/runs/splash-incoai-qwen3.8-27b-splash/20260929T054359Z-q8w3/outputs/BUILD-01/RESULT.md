# RESULT — BUILD-01 (회의실 예약 API 서버)

- case: BUILD-01 · case_version: v0.5-character-1 (구간 3)
- model: splash/incoai/Qwen3.8-27B-Splash
- 시작: 2026-09-30T04:56Z / 종료: 2026-09-30T05:20Z / 경과: 약 24분
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 실행 방법
- `node server.mjs` → 기본 **3000** 포트. `PORT` 환경 변수가 있으면 그 포트.
- `DB` 환경 변수가 없으면 서버 파일 옆 `reservations.json`에 저장(재시작 유지). `DB`를 주면 그 경로 사용(테스트 격리용).
- 외부 패키지 없음, `node:` 내장 모듈만(`http`, `fs`, `url`, `path`, `crypto`).

## 엔드포인트·규칙 구현
| 요구 | 구현 |
|---|---|
| GET /rooms | `{rooms:["A","B","C"]}` |
| POST /reservations | `{room,from,to,by}` 검증 → 201 + `{id,room,from,to,by}` (id = `crypto.randomUUID()`) |
| GET /reservations?room=A | room 생략 시 전체, 지정 시 해당 방. unknown room → 400 |
| DELETE /reservations/:id | 존재 → 204, 부재 → 404 |
| 겹침(같은 방) | 반개간 `[from,to)` — `aFrom<bTo && bFrom<aTo` → 409 (경계 접점은 충돌 아님) |
| from>=to / 과거 / 존재 없는 방 / 필수 누락 | 각각 400 + error 메시지 |
| 깨진 JSON | 400 |
| 영속화 | mutations(POST/DELETE)마다 `reservations.json` 동기 기록, 시작 시 로드 |

## 확인한 동작 (자체 검증)
- `node test.mjs` → **25/25 통과** (spawn+global fetch로 실제 서버 호출).
  - rooms/create/echo, room별·전체 조회, 409 겹침, **경계 접점 201(반개간)**, 400×(from>=to·과거·방없음·필드누락·깨진JSON), 204/404 삭제, unknown room GET 400.
  - **동시성**: 같은 방·같은 시간대에 5개 동시 POST → 정확히 **1건 201, 4건 409** (이중 예약 없음).
  - **영속화**: 4건 저장 → 서버 kill → 재시작 → 동일 4건 복원.
- `PORT=3001 node server.mjs` + `curl /rooms` → 정상 응답. GET만 하면 DB 파일 미생성.

## 동시 요청 처리 설계
- Node 단일 스레드 이벤트 루프 + **동기 fs**(`writeFileSync`). 각 요청 핸들러가 검증→겹침확인→변경→저장을 하나의 작업으로 원자적으로 실행하므로, 동시 요청도 순차 직렬화되어 겹침이 이중 기록되지 않는다. (동기 I/O이 이벤트 루프를 잠시 점유하는 것은 이 규모에서 의도적 트레이드오프.)

## 확인하지 못한 것
- **독립 채점·부하·장시간 동작**: 자체 테스트 통과를 독립 통과로 보지 않음. 수백·수천 동시, 파일 경쟁(멀티 프로세스), 크래시 시 파일 무결성 등은 검증하지 않음.
- ISO 8601 해석은 `Date.parse` 의존. `from`이 "현재"와 동일한 순간은 '과거'로 잡지 않음(`fromMs < now` 엄소). 지문이 이 경계를 명시하지 않아 이 해석을 취함.
- `by`는 존재(비공백)만 검증. 타입 제한은 하지 않음.
- 토큰·속도·비용은 노출 안 돼 null.

## 산출물
- `server.mjs` (제출물), `test.mjs` (자체 검증 스크립트, 부록), `RESULT.md`
