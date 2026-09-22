# BUILD-01 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.5-character-1
- 입력: 없음 (고정 입력 없는 과제)
- 시작 (agent-observed): 2026-09-17T17:20:00Z (추정, 실시간 시계 측정 아님)
- 종료 (agent-observed): 2026-09-17T17:40:00Z (추정, 실시간 시계 측정 아님)
- 경과 (agent-observed): 약 20분
- 산출물: server.mjs, RESULT.md
- 도구: node v24.18.0 (`node --check`, `node server.mjs`), bash, curl

## 실행 방법

```bash
PORT=3199 node outputs/BUILD-01/server.mjs   # 3199번 포트에서 기동
bash tool-workspace/build01_test.sh outputs/BUILD-01   # 동작 검증 스크립트
```

`server.mjs`는 단일 파일이며 `node:` 내장 모듈만 사용한다. `PORT` 환경 변수가 있으면 그 포트, 없으면 3000에서 시작한다.

## 구현 요약

- 회의실 `A`/`B`/`C` 고정. `GET /rooms`로 목록 반환.
- `POST /reservations`는 `{room, from, to, by}`를 받고 `crypto.randomUUID()`로 `id`를 생성해 201과 함께 반환한다.
- 중복 검사: 같은 방에서 `aFrom < bTo && bFrom < aTo`이면 409. 끝점이 접하는 경우(예 10:00–11:00과 11:00–12:00)는 겹침으로 간주하지 않는다.
- 검증: 깨진 JSON → 400, 필수 필드 누락 → 400, 존재하지 않는 방 → 400, 잘못된 ISO → 400, `from >= to` → 400, 과거 시각 → 400.
- `GET /reservations?room=A`는 특정 방, `room` 생략 시 전체 목록을 `{list, count}`로 반환.
- `DELETE /reservations/:id`는 성공 204, 없으면 404.
- 예약은 `reservations.json`에 동기 `fs`로 저장/불러와 서버 재시작 후에도 유지된다. 손실 업데이트를 막기 위해 요청마다 인메모리 상태를 재불러 저장한다.

## 확인한 동작 (자체 검증)

`bash tool-workspace/build01_test.sh outputs/BUILD-01` 실행 결과 **16건 전체 PASS** (fail 0).

- `GET /rooms` → 200
- 유효 예약 POST → 201 + `id`
- 동일 방 시간 겹침 POST → 409
- 끝점 접하는 백투백(11:00–12:00) → 201 (겹침 아님)
- `from == to` → 400
- 과거 시각 → 400
- 존재하지 않는 방 (`Z`) → 400
- 필수 필드 누락 → 400
- 깨진 JSON → 400
- `room=A` 필터 → 2건
- 전체 목록 → 2건 (alice + carol; bob은 409로 제외)
- 존재하는 예약 DELETE → 204
- 없는 예약 DELETE → 404
- DELETE 후 전체 목록 → 1건 (carol 잔여)
- **재시작 후 목록 → 1건 유지** (reservations.json에 영속화됨 확인)

## 확인하지 못한 사항

- **동시 요청(concurrency)**: 동시 POST가 중복을 회피하는지는 실제 병렬 요청으로 검증하지 않았다. 동기 `fs`로 손실 업데이트는 막았으나, 동시성 테스트는 통과하지 못했다.
- **실제 시계로 측정한 소요 시간**: 추정치이며 외부 독립 계측이 아니다.
- **토큰/속도/비용**: 노출되지 않아 `null`/`not_exposed`.
- 이 세션은 파일 격리 환경이 아니므로, 도구 호출 제한과 구현 파일/`tool-state.json` 미읽기 규칙은 지시문에 의한 제한으로만 적용한다.
- 위 16건은 **자체 검증 통과**일 뿐, 별도 채점 기준의 독립 통과를 의미하지 않는다.
