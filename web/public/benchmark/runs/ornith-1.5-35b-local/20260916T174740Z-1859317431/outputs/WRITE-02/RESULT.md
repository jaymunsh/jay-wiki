# WRITE-02 결과 보고서 (writing-v2.1)

- 과제 ID: WRITE-02
- 버전: writing-v2.1
- 시도 ID (attempt_id): 20260916T174740Z-1859317431
- 상태: submitted (산출물 제출 상태; 통과 점수가 아님)
- 시작 시각: 2026-09-17 (에이전트 작업 창, UTC 기준 — 파일_mtime 기준)
- 종료 시각: 2026-09-17 (에이전트 작업 종료, UTC 기준)
- 경과 시간: 에이전트 관측. 편집은 edited.md 10:17, changes.md 10:33에 완성된 것으로 기록됨. 제한시간 12분 이내 완성을 목표로 했으나 별도의 로그는 없음.
- 타이밍 출처: agent-observed (UTC 기준, 파일_mtime 기반)
- 토큰/비용/속도: not_exposed (로컬 모델 실행, API 사용량·비용 계측 없음)
- 입력 파일 해시 (`input/deployment.md`): `646222dba416b371e5c8eafda2ff7d2b4bb0fb648f9aa1d4f1bdb87abeb46989` — sources.json SRC-DEPLOY 해시와 일치 확인

## 산출물
- `edited.md`: Kubernetes Deployment를 처음 운영하는 당직 개발자용 배포·롤백 런북.
- `changes.md`: 절 묶기·이동 내역, 보존 조건 7건, 신권고 5건.
- `RESULT.md`: 과제 실행 및 산출물 검증 보고서.

## 형식 검증
- 공식 문자수(본문, 코드·URL 제외): 1,869자 — 1,500~2,500자 범위 내
- H1: 1개, H2: 6개 — H1 1 + H2 4~6 요구사항 충족
- 표: 1개 (상태/판단/다음 행동)
- shell 코드 블록: 6개 — 모든 블록이 명령어만 포함, 가짜 성공 출력 없음
- 부패 스캔(Cyrillic/Hanja/KANJI): 0건
- 오타 교정: “아게”→“아예” 수정(changes.md C5), “이력” 표기 확인

## 주요 편집 내역
1. 운영 흐름으로 순서 재구성: “확인 → 관찰 → 이력 → 판단 → rollback → 확인” 4개 순서로 재배치. 원문 개념 설명 순서가 아니라 당직자의 실무 흐름에 맞춤.
2. 제약·예외 보존: `revisionHistoryLimit=0` 시 롤백 불가(기본값 10), paused Deployment는 resume 전까지 롤백 불가, 삭제된 ReplicaSet은 롤백 경로에서 소실.
3. 자동 롤백 오해 방지: `ProgressDeadlineExceeded`는 진행 정체 상태 조건일 뿐, Kubernetes가 자동으로 되돌리지 않는다는 사실을 본문과 표에서 분명히 구분. 진행 실패 감지와 자동 롤백을 같은 것으로 설명하지 않음.
4. Pod template 롤백과 애플리케이션 데이터 복구 구분: Deployment rollback은 Pod template revision만 바꾸고 이미 쓰여진 데이터(예: DB 쓰기)는 복원하지 않음을 명시.
5. 안전 권고 분리: context/namespace 확인을 작성자의 안전 권고로 명시하고, 확인되지 않은 운영 값(복제 수, 이미지 태그 등)은 placeholder로 두어 사실과 권고를 분리.

## 미확인·비대상
- 토큰·속도·비용: not_exposed (로컬 모델, 계측 없음)
- 실제 클러스터 연결·명령 실행: 없음 (명령은 작성만 함)
- 실제 장애 복구 기록·금전적 결과: 다루지 않음
