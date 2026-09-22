# BUILD-01 RESULT

- case_version: v0.5-character-1
- 과제: 회의실 예약 API 서버 구현
- 시작(현지): 2026-09-16 15:24:05 KST
- 종료(현지): 2026-09-16 15:28:00 KST (추정, wall-clock)
- 경과: 약 4분 (구현 + curl 검증)
- 산출물: server.mjs, RESULT.md

## 실행 방법

```bash
node server.mjs            # 3000번 포트
PORT=3199 node server.mjs  # 다른 포트
```

외부 패키지 없이 `node:` 내장 모듈만 사용한다. `reservations.json`은 서버 기동 시 자동으로 로드/생성된다.

## 확인한 동작 (curl, wall-clock 관측)

| 테스트 | 기대 | 관측 |
|---|---|---|
| GET /rooms | 200 rooms 목록 | `{"rooms":["A","B","C"]}` 200 ✓ |
| POST 유효 예약 | 201 + id | 201, UUID id 포함 ✓ |
| 같은 방 겹침 (10:30–11:30) | 409 | 409 conflict ✓ |
| 인접 예약 (11:00 시작) | 201 | 201 ✓ (반개방구간 [from,to) 적용) |
| 필수 필드 누락 | 400 | 400 missing_fields ✓ |
| 존재하지 않는 방 Z | 400 | 400 invalid_room ✓ |
| from >= to | 400 | 400 invalid_range ✓ |
| 과거 시각 (2020) | 400 | 400 past_time ✓ |
| 깨진 JSON body | 400 | 400 invalid_json ✓ |
| GET /reservations?room=A | 200 목록 | 200 필터 목록 ✓ |
| GET /reservations (room 생략) | 200 전체 | 200 전체 ✓ |
| DELETE 존재하는 예약 | 204 | 204 ✓ |
| DELETE 없는 예약 | 404 | 404 not_found ✓ |
| 서버 재시작 후 데이터 | 유지 | 204 삭제 후 남은 1건이 새 포트(3200)에서도 유지 ✓ |

## 설계 판단

- 겹침: 반개방구간 `[from, to)` 기준 (`aFrom < bTo && bFrom < aTo`). 14:00 종료/14:00 시작은 겹치지 않아 둘 다 허용.
- 영속화: `readFileSync`로 기동 시 로드, 변경 시 `writeFileSync` 동기 저장. 동기 I/O를 선택한 이유는 읽기-수정-쓰기 간 이벤트 루프 교차로 데이터 손실을 방지하기 위함이다.
- 동시 요청: Node 이벤트 루프가 동시 요청을 처리하나, 영속화만 동기로 묶어 일관성 보장.
- from 검증: `from < now`이면 400.

## 확인하지 못한 것

- 실제 동시(병렬) 요청 부하 under stress 테스트는 미수행(단순 순차 curl만 확인).
- `reservations.json`이 이미 존재하는 상태에서의 마이그레이션 등 특수 상황은 미검증.
- 자체 검증을 독립 채점 통과로 해석하지 않는다.

## 토큰/속도/비용

- 노출 없음. Qwen Code 앱이 토큰·속도·비용 정보를 제공하지 않아 `not_exposed`로 기록한다.
