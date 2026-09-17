# nginx-deployment 배포·롤백 런북

## 대상과 전제

이 런북은 Kubernetes Deployment를 처음 운영하는 당직 개발자가 배포 실패를 만났을 때 확인할 순서를 정리한 것이다. 예시는 공식 문서의 nginx-deployment를 그대로 쓰며, 실제 운영 환경에서 실행한 기록이 아니다. 클러스터 context와 namespace를 먼저 확인하라는 권고는 공식 문서의 절차가 아니라 작성자의 안전 권고다. 운영 환경의 namespace, 이미지 태그, replica 수 같은 값은 여기서 알 수 없으므로 `<namespace>`처럼 placeholder로 둔다.

적용하지 않는 범위도 분명히 한다. 이 런북은 Deployment가 관리하는 Pod template의 복구만 다룬다. 데이터베이스나 볼륨에 쓰인 애플리케이션 데이터의 복구는 다루지 않는다. 두 가지는 원인이 다르고 되돌리는 방법도 다르다.

## 1단계 — 배포 상태 확인

먼저 롤아웃이 끝났는지 본다. `kubectl rollout status`는 롤아웃이 성공하면 종료 코드 0을, 진행 기한을 넘기면 0이 아닌 값을 돌려준다. 그래서 이 명령 하나로 "끝났다"와 "멈췄다"를 나눌 수 있다.

```shell
kubectl rollout status deployment/nginx-deployment -n <namespace>
```

종료 코드가 0이 아니면 다음 단계로 간다. Deployment 자체의 조건도 함께 본다.

```shell
kubectl describe deployment nginx-deployment -n <namespace>
```

`.status.conditions`에서 `Progressing`의 `status`와 `reason`을 확인한다. `ProgressDeadlineExceeded`가 보이면 진행 기한을 넘긴 것이다.

## 2단계 — 실패 원인 관찰

ReplicaSet과 Pod를 본다. 새 ReplicaSet의 replica가 올라가지 못하고 있으면 원인이 Pod 쪽에 있다.

```shell
kubectl get rs -n <namespace>
kubectl get pods -n <namespace>
```

Pod가 `ImagePullBackOff` 같은 상태에 머물면 이미지 이름이나 태그 문제다. 공식 문서 예시에서도 이미지 이름을 잘못 적어 새 ReplicaSet이 올라오지 못하는 상황을 다룬다. 관찰한 상태에 따라 다음 판단을 정한다.

| 관찰한 상태 | 판단 | 다음 행동 |
|---|---|---|
| 롤아웃 진행 중, Pod 정상 기동 | 정상 진행 | 완료까지 대기 |
| `ProgressDeadlineExceeded`, Pod 이미지 오류 | 새 버전 문제 | 이전 revision으로 되돌리기 검토 |
| 쿼터·권한 오류로 Pod 생성 실패 | 환경 문제 | 쿼터·권한 조정 후 재시도 |

여기서 한 가지를 구분한다. 진행 실패를 감지하는 것과 자동으로 롤백되는 것은 다르다. Kubernetes는 멈춘 Deployment에 대해 상태 조건을 보고할 뿐이고, 되돌리기 같은 조치는 상위 오케스트레이터가 맡는다. 기본 설정에서 자동 롤백을 기대하면 안 된다.

## 3단계 — 이력 확인과 복구 판단

되돌리기 전에 어떤 revision이 있는지 본다. 되돌리면 Pod template만 이전 상태로 간다.

```shell
kubectl rollout history deployment/nginx-deployment -n <namespace>
kubectl rollout history deployment/nginx-deployment --revision=2 -n <namespace>
```

되돌릴 대상이 정해졌으면 실행한다. revision을 지정하지 않으면 직전 revision으로 간다.

```shell
kubectl rollout undo deployment/nginx-deployment -n <namespace>
kubectl rollout undo deployment/nginx-deployment --to-revision=2 -n <namespace>
```

되돌리기 전에 두 가지 제약을 확인한다. 첫째, `.spec.revisionHistoryLimit`이 0이면 이전 ReplicaSet이 정리되어 되돌릴 수 없다. 기본값은 10이다. 둘째, Deployment가 paused 상태면 Pod template 변경이 새 롤아웃을 만들지 않으므로 되돌리기 결과가 바로 반영되지 않을 수 있다.

Pod template 되돌리기는 데이터 복구가 아니다. 이미지와 설정만 이전으로 가고, 그동안 쓰인 데이터는 그대로 남는다.

## 4단계 — 복구 후 확인

되돌린 뒤에는 상태를 다시 확인한다.

```shell
kubectl get deployment nginx-deployment -n <namespace>
kubectl rollout status deployment/nginx-deployment -n <namespace>
```

`Available`이 `True`이고 `Progressing`의 reason이 `NewReplicaSetAvailable`이면 복구가 끝난 것이다.

## 작업 전·후 체크리스트

작업 전에 확인할 것:

- [ ] 클러스터 context와 namespace가 대상 환경이 맞는가
- [ ] 되돌릴 revision 번호를 `rollout history`로 확인했는가
- [ ] `.spec.revisionHistoryLimit`이 0이 아닌가
- [ ] Deployment가 paused 상태가 아닌가
- [ ] 되돌리기가 데이터 복구가 아니라는 점을 공유했는가

작업 후에 확인할 것:

- [ ] `rollout status` 종료 코드가 0인가
- [ ] `Available` 조건이 `True`인가
- [ ] 이전 ReplicaSet이 0으로 줄었는가
- [ ] 되돌린 이미지 태그가 의도한 값인가
