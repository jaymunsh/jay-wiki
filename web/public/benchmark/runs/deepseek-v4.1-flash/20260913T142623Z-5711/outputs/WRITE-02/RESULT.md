# WRITE-02 결과 — writing-v2.1 재응시

- **과제 ID**: WRITE-02
- **문제 버전**: writing-v2.1 (이전 버전 대체)
- **attempt_id**: 20260914T173839Z-9c722c
- **상태**: submitted
- **점수**: null · **evaluation_status**: pending (독립 채점 대기, 이전 점수 승계 없음)

## 이번 제출 산출물

| 파일 | 설명 |
|---|---|
| `edited.md` | 배포·롤백 런북 (H1 1개, H2 6개, 2,265자) |
| `changes.md` | 편집 내역과 보존한 조건·예외 8건 (source_heading·행 번호 포함) |
| `RESULT.md` | 이 파일 |

이전 버전의 `editing-source.md`와 `.start_utc` 등은 이번 답안으로 평가하지 않는다. 삭제하지 않고 그대로 두었다.

## 사용한 입력과 해시

| 입력 | 경로 | SHA-256 | 대조 |
|---|---|---|---|
| SRC-DEPLOY | `input-writing-v2/deployment.md` | `646222dba416b371e5c8eafda2ff7d2b4bb0fb648f9aa1d4f1bdb87abeb46989` | 일치 |

`cases/writing-v2/sources.json`의 값과 대조해 일치함을 확인했다. 기존 llama.cpp 입력은 수정하지 않았다.

## 읽은 범위

- `cases/writing-v2/README.md`, `WRITE-02.md` 전문.
- `input-writing-v2/deployment.md` 중 다음 절: Updating a Deployment(172~341), Rolling Back a Deployment(386~642), Deployment status(872~1088), Clean up Policy(1089~1109), Revision History Limit(1360~1369), Paused(1370~1376).
- 읽지 않은 절: Creating a Deployment, Scaling a Deployment, Pausing and Resuming(741~871), Canary Deployment, Writing a Deployment Spec 세부 필드, Progress Deadline Seconds·Min Ready Seconds·Terminating Pods(1330~1359).
- 웹 재조회, 다른 모델 답안, 이전 제출물 본문은 읽지 않았다.

## 확인한 형식과 미확인 사항

- 확인: H1 1개, H2 6개, 본문 2,265자(공백 포함, 코드·URL 제외), 상태/판단/다음 행동 표 1개, shell 코드 블록 6개, 작업 전·후 체크리스트.
- 확인: `changes.md`에 보존 조건·예외 8건과 `source_heading`·`line_start`·`line_end`를 기록했다.
- 확인: nginx-deployment 예시를 실제 운영 실행 기록으로 쓰지 않았고, 가짜 성공 출력을 넣지 않았다.
- 미확인: 클러스터 context·namespace·이미지 태그·replica 수 등 운영 값. placeholder로 두었다.
- 미확인: 제시한 명령의 실제 실행 결과. 클러스터에 연결하지 않았다.
- 구분: 클러스터 context·namespace 확인 권고와 체크리스트 구성은 공식 문서의 보장이 아니라 작성자의 운영 권고다. `changes.md`에 분리해 적었다.

## 시간

| 항목 | 값 |
|---|---|
| 시작 (UTC) | 2026-09-14T17:53:47Z |
| 종료 (UTC) | 2026-09-14T17:54:46Z |
| 경과 | 59초 |

입력 복사·해시 대조와 보관 작업 시간은 위 작성 시간에 포함하지 않았다. 응시 간격도 합산하지 않았다.

## 측정 한계

- 토큰 수, 첫 토큰 지연, 출력 속도, 호출·재시도 횟수, 비용은 이 앱에서 노출되지 않아 **null / not_exposed**다.
- 이 환경은 프로세스마다 단조 시계가 초기화되어 단조 시계 기반 경과 측정을 쓸 수 없다. 위 경과는 UTC 벽시계 시작·종료 시각의 차이다.
- 자기 점수와 합격 판정은 만들지 않았다.

## 이전 시도 보관

- 보관 경로: `outputs/WRITE-02/.history/20260914T173839Z-9c722c/previous/`
- 보관 파일 8개, SHA-256 전부 일치 확인(`archive-index.json`).
- 이전 상태·시간·버전 메타데이터: 같은 `.history/<attempt_id>/case-metadata.json`.
