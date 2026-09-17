# 되돌리기 명령만으로 안전한 복구가 보장되는가

## 결론부터

보장되지 않는다. Kubernetes Deployment rollback은 이전 revision의 Pod
template을 되돌리는 제어 동작이다. 데이터베이스 쓰기, 외부 저장소, 이미
처리한 작업의 정합성까지 과거 상태로 되돌린다는 뜻은 아니다. 또한
`ProgressDeadlineExceeded`는 진행 실패를 알리는 상태 조건이지 자동 rollback
완료 신호가 아니다([Kubernetes Deployment 문서](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)).
실제 GitHub 사례도 서로 다른 데이터베이스 쓰기와 긴 백업 복구 시간을 함께
다뤘으므로, 애플리케이션 상태와 데이터 복구를 별도 판단해야 한다
([GitHub 장애 분석](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)).

## 실제 사례 타임라인

자료에 기록된 시각은 모두 UTC다.

| 시각 | 관찰·조치 |
|---|---|
| 2018-10-21 23:19 | 추가 메타데이터 쓰기를 줄이기 위해 webhook 전달과 GitHub Pages 빌드를 중지했다. |
| 2018-10-22 00:05 | 백업 복원, 양쪽 복제본 동기화, 안정 토폴로지 복귀, 대기 작업 재개 계획을 세웠다. |
| 2018-10-22 00:41 | 영향받은 MySQL 클러스터의 백업 절차가 시작된 상태에서 진행을 관찰했다. |
| 2018-10-22 06:51 | 일부 동부 클러스터가 복원을 마치고 서부의 새 데이터를 복제하기 시작했으며, 더 큰 클러스터는 복원 중이었다. |

이 순서는 명령 하나로 즉시 원복한 기록이 아니다. 쓰기를 줄이고, 복제본의
차이를 다루고, 백업과 적재 진행을 관찰하는 운영 판단의 연속이다.

## 배포 상태와 데이터 정합성

Deployment revision은 Pod template 변경 때 생성되며, scaling만으로는 새
revision이 생기지 않는다. rollback도 그 template 부분만 되돌린다. 반면
GitHub 브리프는 서부에 약 40분의 쓰기와 동부의 비복제 쓰기 수초가 남았다고
설명한다. 따라서 Pod가 정상화된 뒤에도 데이터 충돌·누락·재처리 여부를
별도로 확인해야 한다. Kubernetes는 deadline 초과를 `Progressing=False`와
`ProgressDeadlineExceeded`로 표시하고 계속 재시도할 뿐, 상위 오케스트레이터가
rollback을 선택할 수 있다고만 설명한다.

## 복구 판단 체크리스트

1. 대상 context·namespace·Deployment와 현재 image, revision을 확인한다.
2. `rollout status`, Deployment Conditions, ReplicaSet·Pod Events로 실패 원인을
   구분한다. deadline 초과를 자동 복구로 해석하지 않는다.
3. 선택할 revision의 template과 보존 여부를 확인한다. paused Deployment는
   resume 전 rollback할 수 없다.
4. 데이터베이스 쓰기, 복제 지연, 백업 시점, 재처리·중복 위험을 별도 항목으로
   판정하고, Deployment 정상화만으로 완료 처리하지 않는다.
5. 복구 뒤 desired/updated/available 수, 새 Pod readiness, 오류 Events와
   데이터 검증 결과를 남긴다.

## 후속 개선 제안

아래는 자료가 보고한 성과가 아니라 회의에서 검토할 제안이다.

| 담당 역할 | 우선순위 | 완료를 확인할 기준 |
|---|---|---|
| 배포 운영 담당 | 높음 | 실패 조건·revision 보존·rollback 후 상태 확인 절차를 재현 가능한 문서로 검토한다. |
| 데이터 담당 | 높음 | 복제 차이, 백업 시점, 재처리 규칙을 검증할 체크와 승인 기준을 합의한다. |
| 복구 훈련 담당 | 중간 | 부분 복원과 전체 클러스터 복원의 예상 단계·소요 측정 방법을 정하고 훈련 기록 양식을 만든다. |

백업을 시험했다는 사실만으로 전체 복원 시간이 사라지지는 않는다. Pod
template rollback, 데이터 복원, 사용성 회복을 서로 다른 완료 조건으로 두는
것이 이 자료에서 도출할 수 있는 안전한 결론이다.
