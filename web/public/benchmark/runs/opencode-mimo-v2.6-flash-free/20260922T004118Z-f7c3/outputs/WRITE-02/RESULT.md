# WRITE-02 RESULT

- 과제 ID: WRITE-02 / case_version: **writing-v2.1**
- 상태: submitted (제출 상태이며 채점 통과가 아님, 자기 점수 없음 — 미채점)
- 시작(UTC): 2026-09-22T00:52:31Z (입력 복사·해시 확인 직후, 자료 읽기 전)
- 종료(UTC): 2026-09-22T00:53:46Z (형식 검증·오타 수정 직후 관측)
- 소요: 75초 (agent-observed, 터미널 `date -u`)
- 산출물: `edited.md`, `changes.md`, `deployment.md`(입력 사본), `RESULT.md`

## 사용 입력과 SHA-256

- 입력: `cases/writing-v2/input/deployment.md` → 실행 폴더 `outputs/WRITE-02/deployment.md`로 복사 후 열람.
- 관측 SHA-256: `646222dba416b371e5c8eafda2ff7d2b4bb0fb648f9aa1d4f1bdb87abeb46989`
- `cases/writing-v2/sources.json` 기준값과 **일치** (원본 미수정, 1384행).

## 읽은 범위·방식

- file-tools 방식으로 복사본을 열람. 목차(행 1~40) 확인 후 관련 절을 중심으로 읽음:
  - Updating a Deployment (172~341), Rollover (342~359), Label selector updates (360~385)
  - Rolling Back a Deployment (386~508), Checking Rollout History (509~556), Rolling Back to a Previous Revision (557~642)
  - Pausing and Resuming (741~871)
  - Deployment status (872~1083), Clean up Policy (1089~1108), Operating on a failed deployment (1084~1087)
  - Progress Deadline Seconds (1330~1338), Revision History Limit (1360~1368), Paused (1370~1375)
- 원문의 명령 블록은 편집 대상 설명으로만 인용하고 **실행하지 않음**. 웹 재조회 없음(고정 입력만 사용).
- 앞선 과제에서 같은 원문을 읽은 적이 없음. 세션 연속 실행의 한계는 유효(독립 세션 장문 시험이 아님).

## 확인한 형식

| 항목 | 결과 |
|---|---|
| H1 | 1개 (첫 줄) |
| H2 | 5개 — 요구 4~6 충족 |
| 본문 분량 | 공백 포함 2,319자 (URL·코드블록 포함 검사 동일 — 본문에 URL·코드블록 없음) — 요구 1,500~2,500자 충족 |
| 필수 내용 | Updating / Rolling Back / Deployment status / revisionHistoryLimit 4개 절 + paused Deployment의 resume 전 롤백 불가 note 포함 |
| changes.md | 보존 조건 10건(요구 5건 이상), 각각 source_heading·line_start·line_end 기재 |
| CJK 오염 | 없음 (스캔 통과) |

## 미확인 사항

- "정보 손실 없이 압축했는가"는 독립 채점 전까지 미판정(미채점).
- 원문 1384행 중 본문 필수 절 외(Use Case·Creating·Scaling·Proportional scaling·Canary·Writing a Deployment Spec 등)는 의도적으로 압축 생략함 — 생략 목록은 changes.md 미포함 항목과 일치.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출). 전체 세션 사용량을 과제별로 배분하지 않음.
