# THINK-01 결과 — writing-v2.1 재응시

- **과제 ID**: THINK-01
- **문제 버전**: writing-v2.1 (이전 버전 대체)
- **attempt_id**: 20260914T173839Z-9c722c
- **상태**: submitted
- **점수**: null · **evaluation_status**: pending (독립 채점 대기, 이전 점수 승계 없음)

## 이번 제출 산출물

| 파일 | 설명 |
|---|---|
| `summary.md` | 복구 판단 메모 (H1 1개, H2 5개, 1,762자) |
| `facts.json` | 사실 17건 (SRC-DEPLOY 12건·8개 절, SRC-INCIDENT 5건) |
| `analysis.md` | 여섯 주장 판정 (supported 1 · contradicted 5 · not_established 0) |
| `RESULT.md` | 이 파일 |

이전 버전의 `READING_RULES.md`, `long-context-source.md`, `long-context-sources.json`, `.start_utc` 등은 이번 답안으로 평가하지 않는다. 삭제하지 않고 그대로 두었다.

## 사용한 입력과 해시

| 입력 | 경로 | SHA-256 | 대조 |
|---|---|---|---|
| SRC-DEPLOY | `input-writing-v2/deployment.md` | `646222dba416b371e5c8eafda2ff7d2b4bb0fb648f9aa1d4f1bdb87abeb46989` | 일치 |
| SRC-INCIDENT | `input-writing-v2/incident.md` | `8bddd77b2925ded5854d93893f1e3fa392e36452e8de162c3b3f7546112a4e09` | 일치 |

`cases/writing-v2/sources.json`의 값과 대조해 일치함을 확인했다. 기존 llama.cpp 입력은 수정하지 않았다.

## 실제 읽은 범위

- `cases/writing-v2/README.md`, `THINK-01.md` 전문.
- `input-writing-v2/deployment.md` **전체 1,386행**. 여러 번에 나눠 읽었다: 1~171, 172~411, 412~656, 643~871, 872~1096, 1089~1116, 1116~1354, 1355~1386행. (일부 구간은 겹쳐 읽었다.)
- `input-writing-v2/incident.md` **전체 25행**.
- 읽지 않은 자료: 다른 답안, 평가 전용 자료, 이전 제출물 본문, 웹 문서.

## 출력 잘림·문맥 한계

- 두 입력 파일에서 2,000자를 넘는 행은 없었다(최대 425자·334자). 읽기 도구의 행 길이 제한으로 잘린 구간은 없다.
- 다만 파일 탐색·부분 조회로 읽었으므로, 한 번에 전체를 올린 단일 컨텍스트 시험이 아니다. 절 사이의 연결은 여러 번의 조회를 거쳐 확인했다.
- `deployment.md`에는 Hugo include 표기가 남아 있고 참조 파일은 입력에 포함되지 않는다. include 대상 내용을 읽었다고 주장하지 않는다.
- `incident.md`는 원문 전체가 아니라 벤치마크 편집자가 만든 짧은 사실 브리프다. 원문 전체나 장문 문서로 부르지 않는다.

## 확인한 형식과 미확인 사항

- 확인: `summary.md` H1 1개, H2 5개, 1,762자, 타임라인 표 1개, 후속 제안 표 1개, 체크리스트 5항목. 타임라인 시각은 UTC로 표기했다.
- 확인: `facts.json` 17건 모두 claim·source_id·source_heading·line_start·line_end·condition_or_caveat를 가진다.
- 확인: GitHub 사례를 Kubernetes로 운영됐다고 연결하지 않았고, 실제 담당자·기한·성과를 만들지 않았다.
- 미확인: 후속 개선 제안은 제안이며 실제 담당자·기한·완료 여부는 자료에 없다.
- 미확인: 이 장애의 최종 금전 피해, 고객별 데이터 손실, 정확한 인력 배치. 자료가 스스로 부재를 밝히고 있다.

## 시간

| 항목 | 값 |
|---|---|
| 시작 (UTC) | 2026-09-14T17:55:00Z |
| 종료 (UTC) | 2026-09-14T17:56:41Z |
| 경과 | 101초 |

입력 복사·해시 대조와 보관 작업 시간은 위 작성 시간에 포함하지 않았다. 응시 간격도 합산하지 않았다.

## 측정 한계

- 토큰 수, 첫 토큰 지연, 출력 속도, 호출·재시도 횟수, 비용은 이 앱에서 노출되지 않아 **null / not_exposed**다.
- 이 환경은 프로세스마다 단조 시계가 초기화되어 단조 시계 기반 경과 측정을 쓸 수 없다. 위 경과는 UTC 벽시계 시작·종료 시각의 차이다.
- 순수 단일 컨텍스트 시험이나 실제 장애 대응을 수행했다고 보고하지 않는다.
- 자기 점수와 합격 판정은 만들지 않았다.

## 이전 시도 보관

- 보관 경로: `outputs/THINK-01/.history/20260914T173839Z-9c722c/previous/`
- 보관 파일 11개, SHA-256 전부 일치 확인(`archive-index.json`).
- 이전 상태·시간·버전 메타데이터: 같은 `.history/<attempt_id>/case-metadata.json`.
