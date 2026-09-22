# 배포 실패 시 배포·롤백 런북

## 이 문서의 대상과 전제

이 문서는 Kubernetes Deployment를 처음 운영하는 당직 개발자를 대상으로, 배포 실패 상황에서 확인하고 되돌리는 순서를 정리한 것이다. nginx-deployment 예시를 사용하되 실제 운영 환경에 실행한 기록으로 쓰지 않는다.

- 전제: `kubectl`에 이미 접속되어 있고, 작업할 클러스터 context와 namespace가 정해져 있다고 가정한다.
- 안전 권고: 시작 전 `kubectl config current-context`와 `kubectl get ns`로 현재 context와 namespace를 확인하라. 이는 문서 작성자가 강조하는 안전 확인이지, 문서가 보증하는 운영 값이 아니다.
- 적용하지 않는 범위: Deployment 생성·변경의 기본 개념, ReplicaSet 생성, 네트워크·권한 정책 설계는 다룬다. 실제 장애를 복구한 기록이나 금전적 결과는 다루지 않는다.
- 확인되지 않은 운영 값(복제 수, 이미지 태그 등)은 아래 모두 placeholder로 둔다.

## 순서 1 — 배포 상태 확인과 실패 원인 관찰

```shell
kubectl rollout status deployment/nginx-deployment
```

이 명령은 롤백이 아니라 현재 롤아웃의 진행 상태를 확인한다. 결과는 종료 코드로 판단한다.

```shell
echo $?
```

- `0`: 성공적으로 완료되거나 완료 직전.
- `1`: 진행 시간 초과 등 실패.

상태가 `1`이면 원인을 관찰한다.

```shell
kubectl describe deployment nginx-deployment
```

Conditions에서 `type: Progressing`의 `reason`을 확인한다. `ProgressDeadlineExceeded`이면 진행이 멈췄다는 신호다. 여기에 Kubernetes가 자동으로 되돌리지 않는다. 자동으로 되돌리는 것은 이 상태를 읽는 더 높은 수준의 오케스트레이터의 선택이지, Kubernetes의 기본 동작이 아니다.

## 순서 2 — 이력 확인과 복구 판단

```shell
kubectl rollout history deployment/nginx-deployment
```

어떤 revision이 있는지 확인하고, 되돌릴 revision을 이력에서 고른다.

| 상태 | 판단 | 다음 행동 |
|---|---|---|
| Progressing / ProgressDeadlineExceeded | 롤아웃이 멈춤 | 이전 revision으로 rollback 고려 |
| Available + MinimumReplicasAvailable | 최소 가용성 확보 | 추가 조치 없음 |

진행 실패 감지와 자동 롤백은 같은 것이 아니다. 상태가 실패였다고 자동으로 이전 버전으로 돌아가지 않는다.

## 순서 3 — 백업·데이터 구분과 제약

Pod template을 이전 revision으로 되돌리는 것과 애플리케이션 데이터(예: 데이터베이스 쓰기)를 되돌리는 것은 다르다. Deployment rollback은 Pod template의 revision만 바꾸고, 이미 쓰여진 데이터는 복원하지 않는다.

되돌리기 전에 두 제약을 확인하라.

- revision 보관 제한: `revisionHistoryLimit` 기본값은 10이다. 이 값 이하로 오래된 ReplicaSet이 정리되면 그 revision으로 롤백할 수 없다. 0으로 설정하면 모든 이력이 정리되어 롤백이 아예 불가능해진다.
- paused 제약: rollout을 paused 상태에서는 되돌리기를 다시 resume하기 전까지 수행할 수 없다.

## 순서 4 — rollback 실행과 확인

```shell
kubectl rollout undo deployment/nginx-deployment
kubectl rollout undo deployment/nginx-deployment --to-revision=2
```

마지막으로 복구가 제대로 되었는지 확인한다.

```shell
kubectl rollout status deployment/nginx-deployment
echo $?
```

종료 코드 `0`과 `reason: NewReplicaSetAvailable`을 확인한다.

## 작업 전·후 체크리스트

작업 전:
- [ ] context와 namespace 확인
- [ ] 현재 revision과 실패 원인(reason) 확인
- [ ] 롤백할 revision이 history에 존재하는지 확인
- [ ] revisionHistoryLimit 값 확인(0이 아닌가)
- [ ] 데이터 복구는 별도 절차가 필요하다고 인식

작업 후:
- [ ] rollout status 종료 코드 0 확인
- [ ] Available condition 확인
- [ ] replica 수와 image tag이 placeholder와 일치하는지 확인
