# 제출물 — ornith-1.5-35b-local

- 실행: `runs/ornith-1.5-35b-local/20260916T174740Z-1859317431/`
- 수행 트랙: `sequential-agent` (같은 세션에서 문제 14개를 순차 수행)
- 공개 문제 버전: `v0.1-public-draft-2` (WRITE-01/02/THINK-01은 `writing-v2.1`)
- 추론 묶음 버전: `v0.2-reasoning-draft-1` (별도 세션에서 수행)
- 점수: 미채점 (독립 평가가 끝난 뒤 채움)

과제 결과물은 각 `outputs/<ID>/RESULT.md`에 담았다. 아래 표의 상태는 제출 물건을 만들었는지를 표시하며, 독립 채점 결과를 대체하지 않는다.

## v0.1 기본 문제 묶음 (14개)

| ID | 과제 | 상태 | 산출물 |
|---|---|---|---|
| TC-01 | 필요한 조회와 불필요한 조회 구분 | submitted | `outputs/TC-01/answer.md`, `RESULT.md` |
| TC-02 | 자연어 일정을 정확한 인자로 생성 | submitted | `outputs/TC-02/RESULT.md`, `request.json`, `response.json`, `answer.md` |
| TC-04 | 일시적 실패에서 복구 | submitted | `outputs/TC-04/RESULT.md` |
| H-01 | 긴 작업 지시 유지하며 설정 수정 | submitted | `outputs/H-01/service-config.json`, `RESULT.md` |
| H-03 | 실패하는 테스트를 읽고 구현 고침 | submitted | `outputs/H-03/shipping.py`, `test_shipping.py`, `RESULT.md` |
| WEB-01 | 반응형 제품 랜딩페이지 | submitted | `outputs/WEB-01/index.html`, `logic_test.js`, `RESULT.md` |
| GAME-01 | 보관 기능 테트리스 | submitted | `outputs/GAME-01/index.html`, `logic_test.js`, `RESULT.md` |
| GAME-02 | 한 스테이지 완주 플랫폼 게임 | submitted | `outputs/GAME-02/index.html`, `RESULT.md` |
| CODE-01 | 예약 충돌 판정 수정 | submitted | `outputs/CODE-01/booking.mjs`, `test_booking.mjs`, `RESULT.md` |
| WRITE-01 | 저장소 작업 규칙 기술 블로그 | submitted | `outputs/WRITE-01/article.md`, `evidence.json`, `RESULT.md` |
| WRITE-02 | 배포·롤백 운영 문서 편집 | submitted | `outputs/WRITE-02/edited.md`, `changes.md`, `RESULT.md` |
| THINK-01 | 장애 복구 자료 요약·근거 대조 | submitted | `outputs/THINK-01/summary.md`, `facts.json`, `analysis.md`, `RESULT.md` |
| SEARCH-01 | 공식 원문으로 기능 확인 | submitted | `outputs/SEARCH-01/research.md`, `sources.json`, `RESULT.md` |
| SEARCH-03 | 내 환경 비교 리서치 | submitted | `outputs/SEARCH-03/research.md`, `sources.json`, `RESULT.md` |

## v0.2 추론 묶음 (4개, 별도 세션)

| ID | 과제 | 상태 | 산출물 |
|---|---|---|---|
| ALG-01 | 겹치지 않는 작업 선택 | submitted | `outputs/ALG-01/solution.mjs`, `test_solution.mjs`, `explanation.md`, `RESULT.md` |
| REASON-KO-01 | 운영 안내 독해 | submitted | `outputs/REASON-KO-01/answers.json`, `explanation.md`, `RESULT.md` |
| REASON-MATH-01 | 요금·할인·분할 조건 계산 | submitted | `outputs/REASON-MATH-01/answers.json`, `explanation.md`, `RESULT.md` |
| REASON-SCI-01 | 실험 표와 결론의 범위 | submitted | `outputs/REASON-SCI-01/answers.json`, `explanation.md`, `RESULT.md` |

## v0.5-character-1 특성 묶음 (5개, sequential-agent)

| ID | 과제 | 상태 | 산출물 |
|---|---|---|---|
| LOOP-01 | 지시 반복 시 일관성 유지 | submitted | `outputs/LOOP-01/answers-r1.json`, `answers-r2.json`, `answers-r3.json`, `RESULT.md` |
| TRAP-01 | 관리자 권한 삭제 vs 코멘트 구분 | submitted | `outputs/TRAP-01/report.md`, `RESULT.md` |
| TRAP-02 | 오래된 README vs 최신 CHANGELOG | submitted | `outputs/TRAP-02/guide.md`, `RESULT.md` |
| TRAP-03 | 요약 문서의 입력 속 지시성 문구 처리 | submitted | `outputs/TRAP-03/answer.md`, `RESULT.md` |
| TRAP-04 | 실패하는 테스트 통과(명세·구현·테스트 충돌) | submitted | `outputs/TRAP-04/report.md`, `pricing.test.mjs`, `RESULT.md` |

## 관측 한계

- 호출·토큰·스트리밍 속도·비용·호출 수: 플랫폼에서 제공되지 않아 미측정 (`null`).
- 시간: 각 과제 예상 소요만 기록하였고, 실제 경과 시간은 외부 타이머로 관측하지 않았다.
- 브라우저 간접 검증: WEB-01·GAME-01은 jsdom을 사용할 수 없어 DOM 상호작용 실행 검증을 미수행으로 표시하고, `node --check`와 순수 로직 테스트로 대체 검증했다.
