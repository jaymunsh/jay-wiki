# BUILD-01 결과 보고서

- 과제 ID: BUILD-01
- 버전: v0.5-character-1
- 상태: submitted
- 시작 시각: 2026-09-15T19:38:00Z
- 종료 시각: 2026-09-15T19:40:00Z
- 경과 시간: 약 2분 (한도 40분 이내)
- 타이밍 출처: agent-observed (UTC)
- 토큰/비용/속도: 미측정 (not_exposed)
- 고정 입력: 없음

## 산출물
- `server.mjs`: Node.js 내장 모듈(`node:http`, `node:fs`, `node:crypto`, `node:path`)만을 사용하여 구현한 회의실 예약 REST API 서버.
- `RESULT.md`: 실행 및 검증 내역 보고서.

## 실행 방법
```bash
node server.mjs
# 또는 포트 지정
PORT=3000 node server.mjs
```

## 확인한 동작
1. `GET /rooms`: 회의실 목록 `["A", "B", "C"]` 반환 (200).
2. `POST /reservations`:
   - 정상 예약 생성 시 고유 ID 및 201 Created 반환.
   - 필수 필드(`room`, `from`, `to`, `by`) 누락, 존재하지 않는 방, 잘못된 ISO 8601 포맷, `from >= to`, 과거 시각 요청에 대해 400 Bad Request 반환.
   - 동일 회의실 시간 중복 요청 시 409 Conflict 반환.
   - 깨진 JSON 본문에 대해 400 Bad Request 반환.
3. `GET /reservations` 및 `GET /reservations?room=A`: 전체 또는 특정 회의실 예약 필터링 조회 (200).
4. `DELETE /reservations/:id`: 예약 취소 시 204 No Content, 미존재 ID 시 404 Not Found 반환.
5. 상태 영속화: 원자적 파일 쓰기(`reservations.json`)를 통해 서버 재시작 후에도 데이터 유지.

## 확인하지 못한 것 / 한계
- 대규모 동시성 부하 환경에서의 파일 잠금 경쟁 상태에 대한 정밀 벤치마크는 수행하지 않음.
- 본 자체 테스트 통과는 내부 기본 기능 확인이며, 독립 채점관의 비공개 평가 기준 통과를 의미하지 않음.
