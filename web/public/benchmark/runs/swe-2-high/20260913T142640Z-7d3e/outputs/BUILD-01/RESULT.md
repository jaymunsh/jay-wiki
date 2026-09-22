# BUILD-01 RESULT

- case_version: v0.5-character-1
- task: 회의실 예약 API 서버
- start (UTC): 2026-09-15T19:17:37Z
- end (UTC): 2026-09-15T19:18:50Z
- duration: 약 73초 (한도 40분 내)
- 측정 방법: `date -u`로 작업 전후 wall-clock 기록
- 고정 입력: 없음 (해시 없음)

## 실행 방법

```
node server.mjs          # 기본 3000번
PORT=3107 node server.mjs  # PORT 환경 변수로 변경 가능
```

## 확인한 동작 (실제 curl 요청으로 검증, 포트 3107)

| 검증 | 결과 |
|---|---|
| GET /rooms | 200, `{"rooms":["A","B","C"]}` |
| POST /reservations 정상 | 201 + 생성 id 반환 |
| 같은 방 시간 겹침 | 409 Conflict |
| 종료=시작 맞닿는 예약(반열린 구간) | 201 허용 |
| from >= to | 400 |
| 과거 시각 | 400 |
| 존재하지 않는 방 | 400 |
| 필수 필드 누락(by 없음) | 400 |
| 깨진 JSON 본문 | 400 |
| GET /reservations?room=A | 해당 방 목록만 반환 |
| DELETE /reservations/:id 성공 | 204 |
| DELETE 같은 id 재요청 / 없는 id | 404 |
| 재시작 후 예약 유지 | 생성 → 종료 → 재시작 후 목록에 유지 확인 |

영속화는 `reservations.json`에 임시 파일 쓰기 후 `rename`으로 원자적 갱신. 테스트로 생성된 `reservations.json`은 검증 후 삭제해 산출물을 깨끗하게 유지했다.

## 확인하지 못한 것

- 실제 동시 다수 요청 부하 상황(단일 스레드·동기 파일 쓰기이므로 요청 간 경합은 이벤트 루프 직렬화에 의존)
- 외부 채점 환경에서의 동작(자체 검증이며 독립 채점 통과를 의미하지 않음)

## 계측

- 토큰·속도·비용: not_exposed (이 실행 환경에서 미노출, 역산하지 않음)
