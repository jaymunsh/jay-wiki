# 배포 실패·롤백 런북

## 적용 범위와 전제

이 문서는 Kubernetes `Deployment`의 Pod 템플릿을 바꾼 뒤 실패를 확인하고
`nginx-deployment` 예시를 이전 revision으로 되돌리는 절차다. 클러스터에
접속해 실행한 기록이 아니며, 애플리케이션 데이터베이스 복구나 스키마 변경은
범위에 포함하지 않는다. 아래 `<context>`와 `<namespace>`는 운영자가 실제
대상으로 확인해 채울 값이다. context와 namespace 확인은 문서 명령의 보장이
아니라 안전을 위한 운영 권고다.

## 1. 배포 상태 확인

작업 전 대상과 권한을 확인한 뒤, 배포가 어느 상태인지 확인한다. Kubernetes
공식 문서는 `rollout status`가 성공 시 0을 반환한다고 설명한다
([Deployment 문서](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)).

```shell
kubectl config current-context
kubectl get namespace <namespace>

kubectl get deployment nginx-deployment
kubectl rollout status deployment/nginx-deployment
kubectl describe deployment nginx-deployment
```

`get`의 `READY`, `UP-TO-DATE`, `AVAILABLE`을 desired replica와 비교하고,
`describe`의 Conditions와 Events에서 새 ReplicaSet과 Pod의 상태를 함께 본다.
성공 여부는 예시 출력 문자열을 복사해 판단하지 말고 실제 상태와 종료 코드로
확인한다.

## 2. 실패 원인 관찰과 판단

새 ReplicaSet의 수와 Pod 상태를 분리해 확인한다.

```shell
kubectl get rs
kubectl get pods
kubectl describe deployment nginx-deployment
```

| 상태 또는 단서 | 판단 | 다음 행동 |
|---|---|---|
| `Progressing=True`, 새 ReplicaSet이 늘어남 | 진행 중 | `rollout status`를 관찰하고 새 Pod의 readiness를 확인한다. |
| `ImagePullBackOff`, `FailedCreate` 등 | 이미지·권한·quota 같은 원인 후보가 드러남 | Pod와 Events의 구체적 메시지를 확인한 뒤 수정 또는 복구를 선택한다. |
| `ProgressDeadlineExceeded` | 진행 지연을 보고한 상태이며 자동 롤백 완료가 아니다 | 원인을 해결해 재확인하거나 안정 revision으로 되돌릴지 판단한다. |
| 최신 replica가 모두 available이고 오래된 replica가 없음 | rollout 완료 | 복구가 아니라 정상 배포 후 점검으로 이동한다. |

진행 deadline을 넘겨도 컨트롤러가 하는 일은 상태 조건을 보고하는 것뿐이다.
따라서 실패 감지와 자동 롤백을 같은 의미로 취급하지 않는다. quota, readiness
probe, image pull, 권한, limit range, 애플리케이션 설정 오류 등 원인을 먼저
확인한다.

## 3. 이력 확인과 복구 실행

현재 Pod 템플릿과 revision을 비교할 때는 이력을 확인한다.

```shell
kubectl rollout history deployment/nginx-deployment
kubectl rollout history deployment/nginx-deployment --revision=2
```

안정적인 대상 revision과 변경 내용을 확인한 뒤에만 복구한다.

```shell
kubectl rollout undo deployment/nginx-deployment
kubectl rollout undo deployment/nginx-deployment --to-revision=2
```

이 명령은 Deployment의 Pod template을 되돌린다. 문서도 revision이 Pod
template 변경으로 만들어지고, rollback은 그 부분만 되돌린다고 명시한다.
따라서 데이터베이스 쓰기, 외부 저장소, 이미 처리된 메시지는 별도의 정합성·
백업 절차로 판단해야 한다. paused Deployment는 먼저
`kubectl rollout resume deployment/nginx-deployment`으로 재개해야 rollback할
수 있다.

## 4. 복구 후 확인과 보존 정책

복구 명령의 출력은 성공 기록으로 간주하지 말고 상태를 다시 확인한다.

```shell
kubectl get deployment nginx-deployment
kubectl rollout status deployment/nginx-deployment
kubectl describe deployment nginx-deployment
```

최신 Pod가 원하는 이미지와 설정으로 available인지, old ReplicaSet이 의도대로
정리됐는지, Events에 새 오류가 없는지 확인한다. `.spec.revisionHistoryLimit`은
기본 10개의 old ReplicaSet을 보존하지만, 0으로 두면 history가 정리되어 새
rollout을 undo할 수 없다. 완료 상태 전에는 정리가 시작되지 않을 수 있으므로
실패가 반복될 때 보존 개수만 보고 이력을 가정하지 않는다.

작업 전에는 context·namespace·대상 이름, 현재 image와 revision, 데이터 변경
영향을 기록한다. 작업 후에는 rollout 종료 코드, desired/updated/available 수,
Pod readiness, Events, 선택한 revision과 데이터 복구 절차의 별도 상태를
체크리스트로 남긴다. 이 런북의 명령은 작성만 했으며 실제 클러스터에는
연결하지 않았다.
