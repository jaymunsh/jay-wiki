# STYLE-01 RESULT

- case_version: v0.5-character-1
- 과제 ID: STYLE-01
- 상태: submitted (제출 상태이며 채점 통과가 아님, 자기 점수 없음 — 미채점)
- 시작(UTC): 2026-09-22T01:19:45Z (BUILD-01 마무리 관측 직후)
- 종료(UTC): 2026-09-22T01:19:53Z (분량·금지어 검증 통과 관측)
- 소요: 8초 (agent-observed, 터미널 `date -u`)
- 사용 입력: `input/style01-facts.md`
  - SHA-256: `7c9479d312859b7071a366b50b5d7eb2201b1aba91ab511d3b7baccbea8499eb`
  - sources.json의 STYLE01-FACTS와 **일치** 확인(작업 폴더에 복사 후 대조)
- 산출물: `status-page.md`, `apology-email.md`, `exec-summary.md`, `RESULT.md`

## 확인한 사항

- 분량(Markdown 본문, 공백 포함): status-page **330자**(300~500), apology-email **408자**(400~600), exec-summary **244자**(200~300) — 전부 범위 내. 초안 시점에 apology-email이 396자로 400자 미달이어서 문장 1개를 보강해 통과.
- "죄송합니다" 세 글 통틀어 **2회**(status 1, email 1, exec 0) — 3회 이하 준수.
- 사실 카드에 없는 수치·사실·보상·조치를 추가하지 않았다(발생 시각·105분·312건·원인·중복결제 0건·오청구 0건·재발 방지 문구만 사용). 보상 규정·SLA·담당 인력은 카드에 없다고 명시되어 있어 언급하지 않음(exec-summary에 "확인되지 않은 사항"으로만 표기).
- 레지스터: 공지문=격식체(체언 종결 위주), 메일=정중한 서술체, 보고=명사형 종결.
- CJK 한자 오염 스캔: 0건.

## 미확인 사항

- 독립 채점(사실 보존·레지스터 판정) 전 — 미채점.
- 분량 측정은 Python `len()`으로 본문 전체(제목 포함) 기준이며, 평가자의 셈법(제목 제외 등)과 미세 차이가 있을 수 있음.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
