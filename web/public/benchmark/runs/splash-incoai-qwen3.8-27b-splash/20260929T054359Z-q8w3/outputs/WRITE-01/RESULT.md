# WRITE-01 RESULT — AI 코딩 도구에 저장소 작업 규칙 전달하기

- 상태: submitted
- case_version: writing-v2.1
- 시작: 2026-09-29T12:09:25Z (agent-observed, 입력 읽기 직전)
- 종료: 2026-09-29T12:43:00Z (agent-observed)
- 경과: 약 33분

## 사용 입력과 SHA-256

- `tool-workspace/writing-v2-input/repository-instructions.md`
  - SHA-256: `365153628c94ae1f846e82edcdc814d5162bd71c44ce0a68079542873e75501b`
  - sources.json 기대값과 일치 (검증됨, 불일치 없음)
  - 이 과제는 이 입력만 사용했다. deployment.md·incident.md는 WRITE-01 범위 밖이다.

## 읽은 범위

- `cases/writing-v2/README.md`(공통 규칙), `cases/writing-v2/WRITE-01.md`(고정 프롬프트·산출물·필수 내용)
- `cases/writing-v2/sources.json`(해시·출처·변경 내역)
- `input/repository-instructions.md` 전체 255줄 (GitHub Copilot repository instructions 고정 문서)

## 산출물

- `article.md` — H1 1개(제목), H2 6개. 문제 → 위치 선택(3종 비교표) → 작성 예시(코드 블록) → 적용 확인(references, 참고≠준수) → 도입 체크리스트+한계 → 분리 순서 결론 순.
- `evidence.json` — 핵심 사실 13개. 각 항목에 claim, source_id=SRC-AGENT, source_heading, line_start, line_end(고정 input 기준). 창작 예시는 사실 근거로 세지 않았다.

## 형식·요구 확인

- 한국어 평서체, 짧은 문단. 표=위치 비교, 번호/체크=확인 항목 순서. 장식 표·무의미 볼드·줄바꿈 남발 없음.
- 분량: 요구 2,000~3,500자. README 기준(공백 포함, 코드·URL 제외) — 본문 2,948자(코드 블록 제외, 공백 포함). 인라인 코드·표까지 제외해도 2,444자(공백 포함). 전체 파일은 3,279자(공백 포함)/2,572자(공백 제외). 공백 포함 기준으로 모든 해석이 2,000~3,500 범위 내.
- H2 6개 (요구 4~6개).
- 비교표: 저장소 전체 / 경로별 / AGENTS.md 의 파일·위치·적용 범위·성격. 제품별 지원(Copilot, AGENTS.md 컨벤션)을 모든 AI 도구 공통 보장이 아니라고 명시.
- 작성 예시: 교육용임을 명시, 프로젝트 개요·검증 절차·변경 범위 3축 포함. `make` 명령은 예시용이라 "실제 이 저장소 명령이 아니다"라고 밝혀 검증 완료로 둔 적 없음.
- 적용 확인: references 목록에서 `.github/copilot-instructions.md`가 나열되는지, 참고(참조)와 준수(계약) 차이, 충돌·우선순위(개인>저장소>조직), code review head 브랜치 읽기.
- 도입 체크리스트 5개 + 한계(자동 추가는 계약 아님, 길이 희석, 충돌, 우선순위).
- 마지막 문단: "항상/절대"를 전역에 남기고 영역·도구차를 아래로 내리는 실행 결론(과제 보고서·채점표 아님).
- 경험담·성과·로그·지원 범위 날조 없음. 제품 특정 사실은 출처 링크를 달았다.

## 미확인 사항 / 한계

- 웹 재조회 금지 규칙에 따라 출처 URL은 표기만 하고 재조회하지 않았다. 고정 input 255줄 안에서만 근거했다.
- 입력이 reusable 펼침·제품명 치환된 adapted 문서라, 원본 GitHub 문서의 최신 세부 지원 표(링크 대상)는 입력에 포함되지 않아 "모든 기능 지원"까지 주장하지 않았다.
- 토큰·속도·비용: 미제공 (null, not_exposed).
