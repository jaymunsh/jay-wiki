# Kubernetes Deployment 배포·장애 롤백 런북

## 대상·전제·적용하지 않는 범위

이 런북은 Deployment 롤아웃 실패 시 당직자의 절차다. 예시는 공식 문서 `nginx-deployment`을 옮겨 적은 것이지 실제 운영 기록이 아니다. 실행 전 `<namespace>`·`<deployment>`를 실제 값으로 바꾼다.

- 전제: kubectl이 설정된 클러스터, 대상 namespace에 대한 읽기 권한.
- 안전 권고(공식 문서 보장 아님): 작업 전 `kubectl config current-context`와 namespace를 반드시 확인. 작성자의 추가 안전장치다.
- 적용하지 않는 범위: 애플리케이션 데이터(데이터베이스, 볼륨) 복구. 배포 롤백은 Pod template만 돌린다.

## 1) 배포 상태 확인

진행 중인지, 완료됐는지, 멈췄는지 먼저 본다.

```shell
kubectl rollout status deployment/<deployment> -n <namespace>
```

끝날 때까지 블로킹된다. 성공 시 종료 0과 "successfully rolled out", progress deadline 초과 시 비-0과 "exceeded its progress deadline". 현재 상태는 `get`·`describe`으로 본다.

```shell
kubectl get deployment <deployment> -n <namespace>
kubectl describe deployment <deployment> -n <namespace>
```

`describe`의 Conditions에서 `Progressing`은 진행, `Available`은 가용성.

## 2) 실패 원인 관찰

멈춰 있으면 어떤 Pod·ReplicaSet이 안 되는지 본다.

```shell
kubectl get rs -n <namespace>
kubectl get pods -n <namespace>
```

문서 예시의 이미지 태그 오타(`nginx:1.161`)가 있으면 새 ReplicaSet Pod이 `ImagePullBackOff`에 멈춘다. 컨트롤러는 `maxUnavailable`에 따라 스케일업을 **중지**하지만, 이것도 롤백이 아니다.

| 관찰된 상태 | 판단 | 다음 행동 |
|---|---|---|
| `rollout status` 종료 0, READY=원하는 수 | 롤아웃 성공 | 조치 없이 종료 |
| "Waiting for rollout to finish" 지속, `ImagePullBackOff`/`CrashLoopBackOff` | 신규 버전 장애 | 원인 확인 후 롤백 판단 |
| `Progressing: False, reason: ProgressDeadlineExceeded` | 진행 마감 초과 | 실패로 간주, 롤백 판단 |
| `Available: False` | 가용성 저하 | 가용성 확보 후 롤백 판단 |

중요 구분: 컨트롤러의 자동 중지(잘못된 롤아웃 중단)는 이전 리비전으로 되돌리는 undo와 다르다. Kubernetes는 멈춘 Deployment를 **자동 롤백하지 않고** `ProgressDeadlineExceeded`만 보고한다. 롤백은 운영자가 결정한다.

## 3) 이력 확인과 복구 판단

롤백 전 어떤 리비전이 안정됐는지 확인한다.

```shell
kubectl rollout history deployment/<deployment> -n <namespace>
kubectl rollout history deployment/<deployment> --revision=<N> -n <namespace>
```

`CHANGE-CAUSE`는 `kubernetes.io/change-cause` 주석에서 온다. 예시는 revision 2가 안정됐다고 판단해 롤백한다.

```shell
kubectl rollout undo deployment/<deployment> -n <namespace> --to-revision=2
```

롤백은 **Pod template(`.spec.template`)만** 되돌리며, DB·볼륨 등 애플리케이션 데이터는 복구되지 않는다(별도 절차). `.spec.revisionHistoryLimit`이 0이면 오래된 ReplicaSet이 지워져 **롤백 불가**(기본 10). **paused Deployment는 롤백 불가**라 먼저 `kubectl rollout resume` 후 undo한다.

## 4) 복구 후 확인

롤백이 실제로 됐는지 확인한다.

```shell
kubectl get deployment <deployment> -n <namespace>
kubectl describe deployment <deployment> -n <namespace>
kubectl rollout status deployment/<deployment> -n <namespace>
```

READY·AVAILABLE 회복 여부, `describe`의 `DeploymentRollback` 이벤트, `rollout status` 종료 0을 본다. complete 뒤 revisionHistoryLimit 정리로 ReplicaSet이 지워질 수 있어 의도한 리비전이 떠는지 교차 확인한다.

## 작업 전·후 체크리스트

- 작업 전: `kubectl config current-context`·namespace가 대상 환경인지. `revisionHistoryLimit`이 0 아닌지, 대상 리비전이 history에 있는지. paused면 먼저 resume 계획. 현재 `get rs`·`describe` 기록해 두기.
- 작업 후: `rollout status` 종료 0, READY·AVAILABLE = 원하는 수. Pod `Running`/`Ready`이고 `ImagePullBackOff`·`CrashLoopBackOff`가 없는지. Pod Template 이미지 태그가 의도한 리비전과 일치하는지. 데이터 롤백 필요 시 애플리케이션 데이터 상태가 대상 버전과 일치하는지.
