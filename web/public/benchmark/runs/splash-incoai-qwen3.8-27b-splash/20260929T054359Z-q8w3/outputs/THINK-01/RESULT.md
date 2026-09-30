# RESULT — THINK-01

- case: THINK-01 (장문 탐색·근거 대조)
- case_version: writing-v2.1
- model: splash/incoai/Qwen3.8-27B-Splash
- 시작: 2026-09-29T13:33:51Z / 종료: 2026-09-29T14:29:30Z / 경과: 3339초 (약 55분 39초)
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 사용 입력과 SHA-256

| source_id | 파일 | SHA-256 (측정) | sources.json | 일치 |
|---|---|---|---|---|
| SRC-DEPLOY | tool-workspace/writing-v2-input/deployment.md | 646222dba416b371e5c8eafda2ff7d2b4bb0fb648f9aa1d4f1bdb87abeb46989 | 동일 | 일치 |
| SRC-INCIDENT | tool-workspace/writing-v2-input/incident.md | 8bddd77b2925ded5854d93893f1e3fa392e36452e8de162c3b3f7546112a4e09 | 동일 | 일치 |

두 입력 모두 sources.json의 SHA-256과 일치해 검증 통과했다.

## 읽은 범위

- deployment.md: 전체 1,384행을 절 단위로 읽음. 앞(L1-171: front matter, Use Case, Creating, Pod-template-hash)·중간(L172-1130: Updating, Rolling Back, History, Pausing/Resuming, Deployment status, Complete, Failed, Clean up Policy, Writing a Deployment Spec)·뒤(L1131-1384: Pod Template, Replicas, Selector, Strategy, maxUnavailable/maxSurge, Progress Deadline, Min Ready Seconds, Revision History Limit, Paused). 인용에 사용한 핵심 행(L174-177, L392-399, L509-534, L895-916, L973-977, L1330-1338, L1360-1368)을 grep·재읽기로 위치를 확정했다.
- incident.md: 전체 25행 전부 읽음.
- Hugo include 대상 파일(`{{% code_sample %}`, `{{< note >}}`의 참조 문서)은 입력에 포함되지 않으므로 "include까지 읽었다"고 주장하지 않는다. 입력 내 텍스트만 근거로 삼았다.

## 확인한 형식

- summary.md: 한국어 평서체, H1 1개 + H2 5개, 결론→타임라인(UTC 표)→차이→체크리스트→개선 제안 표 순서. Markdown 본문 공백 포함 2,185자(코드·URL 제외) → 1,500~2,500 범위 내.
- facts.json: 15개 fact. SRC-DEPLOY 10개(앞·중간·뒤 4개 이상 절), SRC-INCIDENT 5개(4개 이상). 각 fact에 claim/source_id/source_heading/line_start/line_end/condition_or_caveat 포함. JSON 파싱 유효.
- analysis.md: 6개 명제를 supported/contradicted/not_established로 판정, 각 명제에 정확 행 근거 + 추론. 두 자료의 관계(서로 다른 시스템, 같은 사건으로 섞지 않음) 주의 문단 포함.

## 미확인·한계 사항

- 실제 클러스터/장애 응시에 대한 실측·로그·피해 수치는 입력에 없어 미확인이다. summary·analysis 모두 이를 "입력 근거"/"미확립"으로만 서술했다.
- 명제 5(전체 복원 시간 무시 수준)는 입력이 정량하지 않아 not_established로 판정했다.
- 본 산출물은 단일 세션의 문서 탐색·근거 대조 작업이다. 실제 장애 대응, 실제 배포·롤백 실행, 웹 발행을 한 것이 아니다.
- 토큰·속도·비용은 이 런타임에서 노출되지 않아 null이다.
