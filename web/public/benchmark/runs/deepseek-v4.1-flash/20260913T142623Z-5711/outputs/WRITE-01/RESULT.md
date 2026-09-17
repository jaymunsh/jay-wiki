# WRITE-01 결과 — writing-v2.1 재응시

- **과제 ID**: WRITE-01
- **문제 버전**: writing-v2.1 (이전 버전 대체)
- **attempt_id**: 20260914T173839Z-9c722c
- **상태**: submitted
- **점수**: null · **evaluation_status**: pending (독립 채점 대기, 이전 점수 승계 없음)

## 이번 제출 산출물

| 파일 | 설명 |
|---|---|
| `article.md` | 기술 블로그 본문 (H1 1개, H2 6개, 2,574자) |
| `evidence.json` | 핵심 사실 19개 (claim·source_id·source_heading·line_start·line_end) |
| `RESULT.md` | 이 파일 |

이전 버전의 `READING_RULES.md`, `long-context-source.md`, `long-context-sources.json`, `.start_utc` 등은 이번 답안으로 평가하지 않는다. 삭제하지 않고 그대로 두었다.

## 사용한 입력과 해시

| 입력 | 경로 | SHA-256 | 대조 |
|---|---|---|---|
| SRC-AGENT | `input-writing-v2/repository-instructions.md` | `365153628c94ae1f846e82edcdc814d5162bd71c44ce0a68079542873e75501b` | 일치 |

`cases/writing-v2/sources.json`의 값과 대조해 일치함을 확인했다. 기존 llama.cpp 입력은 수정하지 않았다.

## 읽은 범위

- `cases/writing-v2/README.md`, `WRITE-01.md` 전문.
- `input-writing-v2/repository-instructions.md` 전문 255행(전체).
- `sources.json`의 SRC-AGENT 항목(해시·출처·변경 메모).
- 웹 재조회, 다른 모델 답안, 이전 제출물 본문은 읽지 않았다.

## 확인한 형식과 미확인 사항

- 확인: H1 1개(첫 줄), H2 6개, 본문 2,574자(공백 포함, 코드·URL 제외), 비교표 1개, Markdown 코드 블록 1개(교육용 예시 명시), 체크리스트 5항목.
- 확인: `evidence.json` 항목 19개 모두 필수 키를 가진다. 행 번호는 고정 입력 `repository-instructions.md` 기준이다.
- 미확인: 본문의 빌드·테스트 명령은 **교육용 예시**이며 실제로 실행해 검증하지 않았다. 이 저장소의 실제 설정도 아니다.
- 미확인: 다른 AI 도구가 같은 파일 이름·위치를 지원하는지. 본문에서 "보장이 아니다"라고 명시했다.

## 시간

| 항목 | 값 |
|---|---|
| 시작 (UTC) | 2026-09-14T17:52:05Z |
| 종료 (UTC) | 2026-09-14T17:53:32Z |
| 경과 | 87초 |

입력 복사·해시 대조와 보관 작업 시간은 위 작성 시간에 포함하지 않았다. 응시 간격(1라운드 이후 며칠)도 합산하지 않았다.

## 측정 한계

- 토큰 수, 첫 토큰 지연, 출력 속도, 호출·재시도 횟수, 비용은 이 앱에서 노출되지 않아 **null / not_exposed**다.
- 이 환경은 프로세스마다 단조 시계가 초기화되어 단조 시계 기반 경과 측정을 쓸 수 없다. 위 경과는 UTC 벽시계 시작·종료 시각의 차이다.
- 자기 점수와 합격 판정은 만들지 않았다.

## 이전 시도 보관

- 보관 경로: `outputs/WRITE-01/.history/20260914T173839Z-9c722c/previous/`
- 보관 파일 10개, SHA-256 전부 일치 확인(`archive-index.json`).
- 이전 상태·시간·버전 메타데이터: 같은 `.history/<attempt_id>/case-metadata.json`.
