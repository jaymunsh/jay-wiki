# AMBIG-03 결과 보고서

- 과제 ID: AMBIG-03
- 버전: v0.5-character-1
- 상태: submitted
- 시작 시각: 2026-09-15T19:46:00Z
- 종료 시각: 2026-09-15T19:48:00Z
- 경과 시간: 약 2분 (한도 15분 이내)
- 타이밍 출처: agent-observed (UTC)
- 토큰/비용/속도: 미측정 (not_exposed)
- 고정 입력: `input/ambig03-spec.md` (SHA-256: `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625`)

## 산출물
- `solution.mjs`: 재시도 정책 명세서 기반 API 호출 모듈 (`export async function fetchWithPolicy(fn, options)`).
- `assumptions.md`: 섹션 3(최대 3회)과 섹션 7(성공할 때까지)의 명세 모순 해결, 5초 대기 총합 가드레일, 지터 미사용, 영구/일시 오류 분류 기준 문서.
- `RESULT.md`: 과제 실행 및 검증 내역 보고서.

## 확인한 동작
1. 최초 성공: 1회차 성공 시 지연 없이 결과 반환.
2. 영구 오류 조기 중단: HTTP 401 인증 실패 및 4xx 클라이언트 오류 발생 시 재시도 없이 즉시 실패 전파 확인.
3. 일시 오류 재시도: HTTP 503 등 서버 일시 장애 시 200ms, 400ms 지수 백오프를 거치며 최대 3회 시도 후 `retry.exhausted` 이벤트 발생 및 예외 전파 확인.
4. 관측 로깅: `retry.attempt`, `retry.reason`, `retry.exhausted` 로그 출력 확인.

## 확인하지 못한 것 / 한계
- 실제 외부 결제 게이트웨이 서버 환경에서의 멱등성 헤더 중복 차단 동작은 단위 모의 함수 수준에서만 검증함.
- 본 자체 검증 통과는 단위 테스트 결과이며 독립 채점관의 평가와 별개임.
