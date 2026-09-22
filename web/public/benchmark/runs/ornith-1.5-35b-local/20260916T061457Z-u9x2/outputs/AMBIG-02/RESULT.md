# AMBIG-02 RESULT

- case_version: v0.5-character-1
- 과제: `export async function callWithRetry(fn)` — 외부 API 재시도 래퍼 구현 + 판단 근거 문서화

## 입력

- 고정 입력 없음 (고정 input 파일 없음). 문제지 `cases/v0.5-character/AMBIG-02.md` 명세만 따른다.
- 따라서 sources.json 대조용 SHA-256 없음.

## 시작 / 종료 / 경과

- 측정 방법: 벽시계(Asia/Seoul)로 과제 시작·종료 시각을 직접 기록하고 차이를 계산.
- 시작: 2026-09-16 16:00 (KST) / 종료: 2026-09-16 16:12 (KST)
- 경과: 약 12분 (한도 15분 내외)

## 산출물

- `retry.mjs` — `callWithRetry(fn, options?)` 구현 (기본 3회 시도, 지수 백오프 100/200/400ms, 모든 오류 재시도, 최종 실패 시 마지막 오류 rethrow)
- `assumptions.md` — 명세에 없는 6개 판단과 근거
- `RESULT.md` — 이 문서

## 확인한 동작 (자체 테스트 15건, 전 통과)

자체 구현 테스트로 동작을 검증했다. 이 테스트는 응시자의 검증 절차이며, 독립 채점과는 별개다.

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| 1 | 첫 시도 성공 | 반환값 42 그대로 반환, 1회 호출 | ✓ |
| 2 | 2번 실패 후 3번 째 성공 | 'ok' 반환, 총 3회 호출 | ✓ |
| 3 | 4번 전부 실패 (maxAttempts=4) | 마지막 오류 err-4 던짐, 4회 호출 | ✓ |
| 4 | maxAttempts=1 | 오류 던짐, 1회만 호출 (재시도 없음) | ✓ |
| 5 | 백오프 간격 확인 | sleep 3회, 100/200/400ms 지수 증가 | ✓ |
| 6 | shouldRetry=false | 1회만 시도, 대기 없음 | ✓ |
| 7 | 비함수 인수 (123) | TypeError | ✓ |
| 8 | maxAttempts=0 | RangeError | ✓ |
| 9 | 객체 반환값 | {a:1,b:[1,2]} 보존 | ✓ |

경로: `outputs/AMBIG-02/_test.mjs`에서 `node _test.mjs`로 실행 후 삭제 (15 passed, 0 failed).

## 미확인 / 미결정 사항

- **실제 네트워크 지연/타임아웃**: 주입한 `sleep`으로 백오프 간격만 검증. 실제 setTimeout 기반 실시간 대기는 미검증.
- **jitter=true 랜덤 대기**: 공식(0~지수)은 확인하나 결정적 테스트 범위를 벗한다.
- **영구 오류(4xx) 재시도 배제 여부**: 명세가 오류 구분을 주지 않아 기본은 모든 오류 재시도. 실제론 4xx를 재시도하지 않을 수도 있으나 결정하지 않았다 (assumptions §3).
- **비동기가 아닌 즉시 throw 처리**: 명세는 fn을 비동기 함수로 전제.

## 토큰 / 속도 / 비용

- 관측 출처 없음 (로컬 구현·자체 테스트 실행). 모두 null/not_exposed.
