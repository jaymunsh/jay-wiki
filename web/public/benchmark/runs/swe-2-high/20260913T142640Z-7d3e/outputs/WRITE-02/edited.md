# Deployment 배포 실패 런북

대상: Kubernetes Deployment를 처음 운영하는 당직 개발자. 전제: `kubectl`로 클러스터에 접근할 수 있고, 공식 문서의 `nginx-deployment` 예시를 따른다. 이 문서는 Deployment의 Pod 템플릿 복구만 다룬다. 데이터베이스·영구 볼륨 같은 애플리케이션 데이터 복구, DaemonSet·StatefulSet은 범위 밖이다.

> 작성자의 안전 권고(공식 문서 외): 명령 전에 `kubectl config current-context`로 클러스터 context와 대상 namespace를 확인한다. 아래 `<NAMESPACE>`·`<REVISION>`은 미확인 값의 placeholder다.

## 1. 배포 상태 확인

```shell
kubectl rollout status deployment/nginx-deployment -n <NAMESPACE>
```

목적: 진행 중인지 멈췄는지 확인한다. `Waiting for rollout to finish: ...`가 계속되면 진행 지체다. `progressDeadlineSeconds`(기본 600초)를 넘기면 컨트롤러가 `Progressing=False / reason=ProgressDeadlineExceeded` 조건을 상태에 기록한다. 다음 판단: 지체가 확인되면 원인을 본다.

## 2. 실패 원인 관찰

```shell
kubectl describe deployment nginx-deployment -n <NAMESPACE>
kubectl get pods -n <NAMESPACE>
```

목적: describe 출력의 Replicas 요약·Conditions·Events에서 새 ReplicaSet이 어디까지 갔는지 보고, get pods로 개별 Pod 상태(`ImagePullBackOff` 등)를 찾는다. 공식 문서가 나열하는 대표 원인은 할당량 부족, readiness probe 실패, 이미지 풀 오류, 권한 부족, limit range, 애플리케이션 설정 오류다. 컨트롤러는 `maxUnavailable` 한도 안에서 잘못된 rollout의 확장을 자동으로 멈춘다 — 단, 이것은 "진행 실패를 감지"하는 것이지 자동 롤백이 아니다. Kubernetes는 `ProgressDeadlineExceeded`를 보고만 하고 되돌리지는 않는다(상위 오케스트레이터가 그 조건을 보고 롤백할 수 있다).

## 3. 이력 확인

```shell
kubectl rollout history deployment/nginx-deployment -n <NAMESPACE>
kubectl rollout history deployment/nginx-deployment --revision=<REVISION>
```

목적: 돌아갈 revision을 고른다. 첫 명령이 revision 목록, 두 번째가 특정 revision의 Pod 템플릿 세부다. `CHANGE-CAUSE`는 `kubernetes.io/change-cause` 어노테이션에서 복사되므로 사전에 기록해 두면 원인 파악이 빠르다. 주의: revision은 Pod 템플릿(`.spec.template`)이 바뀔 때만 생긴다 — 스케일링만으로는 만들어지지 않는다.

## 4. 복구 판단과 롤백

| 상태 | 판단 | 다음 행동 |
|---|---|---|
| rollout 진행 중 | 기다릴 근거 있음 | status 재관찰 |
| ProgressDeadlineExceeded | 진행 실패 보고됨 | 원인 확인 후 롤백 여부 결정 |
| paused 상태 | 롤백 불가 | resume 후 롤백 |
| revisionHistoryLimit=0 | 이력 없음 | 롤백 불가, 템플릿 수동 복구 |

```shell
kubectl rollout undo deployment/nginx-deployment -n <NAMESPACE>
kubectl rollout undo deployment/nginx-deployment --to-revision=<REVISION>
```

목적: 직전 또는 지정 revision으로 Pod 템플릿을 되돌린다. 이 명령이 되돌리는 것은 Pod 템플릿뿐이다 — 애플리케이션 데이터나 스키마는 원복되지 않으므로 데이터 영향은 별도로 판단한다.

## 5. 복구 후 확인

```shell
kubectl get deployment nginx-deployment -n <NAMESPACE>
kubectl describe deployment nginx-deployment -n <NAMESPACE>
```

목적: `READY 3/3`, `UP-TO-DATE`, `AVAILABLE`이 기대값인지, Events에 `DeploymentRollback`(해당 revision으로 롤백)이 기록됐는지 확인한다.

## 작업 전·후 체크리스트

- [ ] 작업 전: 올바른 context·namespace인지 확인했다
- [ ] 작업 전: `progressDeadlineSeconds`와 `revisionHistoryLimit`(기본 10, 0이면 이력 삭제) 값을 확인했다
- [ ] 작업 전: 롤백 대상 Deployment가 paused가 아닌지 확인했다(paused면 resume까지)
- [ ] 작업 후: describe의 Conditions가 `Available=True`, `Progressing=True(NewReplicaSetAvailable)`인지 확인했다
- [ ] 작업 후: 새 Pod들이 Ready이고 이벤트에 롤백 기록이 있는지 확인했다
- [ ] 작업 후: 데이터·스키마 등 Pod 템플릿 밖 영향을 별도로 확인했다
