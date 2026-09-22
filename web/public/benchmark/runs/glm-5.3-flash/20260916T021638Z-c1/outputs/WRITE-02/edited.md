# 배포·롤백 런북 — Kubernetes Deployment (nginx-deployment 기준)

Kubernetes Deployment를 처음 운영하는 당직 개발자가 배포 실패 시 따라할 런북이다. 이 문서는 Kubernetes 공식 문서의 [Deployment 문서](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)를 한국어로 편집한 것이며, 예시는 공식 문서의 `nginx-deployment` 예시를 그대로 쓴다. 실제 운영 환경에 실행한 기록이 아니다.

## 대상과 전제, 적용하지 않는 범위

- 대상: 단일 클러스터에서 Deployment로 애플리케이션을 배포하는 개발자·당직자.
- 전제: `kubectl`이 설치되어 있고 대상 클러스터에 접근할 수 있다.
- 작성자의 안전 권고(공식 문서의 보장이 아님): 작업 전에 어떤 클러스터·네임스페이스를 보고 있는지 반드시 확인한다. `kubectl config current-context`와 `kubectl config get-contexts`, 필요하면 `-n <namespace>` 사용. 아래 명령의 `<namespace>` 등은 placeholder이며 실제 환경 값으로 바꿔야 한다.
- 적용하지 않는 범위: 애플리케이션 데이터(데이터베이스 등) 복구, 네트워크·스토리지 장애 대응. 이 문서의 롤백은 Deployment의 Pod template만 되돌린다.

## 1단계 — 배포 상태 확인

먼저 현재 상태를 확인한다. 완료됐으면 종료 코드 0, 진행 마감시간 초과 등 실패면 0이 아닌 종료 코드를 반환한다(공식 문서 915~932행, 1065~1082행).

```shell
kubectl rollout status deployment/nginx-deployment
```

상태는 progressing / complete / failed로 구분된다(872~875행). 실패로 알려진 원인은 쿼터 부족, readiness probe 실패, 이미지 풀 오류, 권한 부족, limit range, 앱 런타임 설정 오류다(936~944행).

## 2단계 — 실패 원인 관찰

레플리카셋과 파드를 보면 어떤 단계에서 막혔는지 확인할 수 있다. 새 ReplicaSet의 파드가 `ImagePullBackOff`에 걸려 있으면 이미지 태그 오류 같은 템플릿 문제다(442~455행).

```shell
kubectl get rs
kubectl get pods
kubectl describe deployment nginx-deployment
```

`describe`의 `Conditions`에서 `Progressing: False, Reason: ProgressDeadlineExceeded`가 보이면 진행 마감시간을 넘어 정체된 것이다(1034~1044행). 참고로 Deployment 컨트롤러는 나쁜 롤아웃을 자동으로 중단해 새 ReplicaSet 확장을 멈춘다(457~459행). 이는 감지이지 자동 롤백이 아니다.

## 3단계 — 이력 확인

롤백 전에 어떤 리비전으로 되돌릴지 정한다.

```shell
kubectl rollout history deployment/nginx-deployment
kubectl rollout history deployment/nginx-deployment --revision=2
```

`CHANGE-CAUSE`를 채우던 `--record` 플래그는 폐기 예정이다(533행).

## 4단계 — 복구 판단과 롤백

파드 template의 잘못된 변경(예: 오타 이미지 태그)이라면 이전 리비전으로 되돌리는 것이 표준 수순이다(386~390행, 401~404행).

```shell
kubectl rollout undo deployment/nginx-deployment          # 직전 리비전으로
kubectl rollout undo deployment/nginx-deployment --to-revision=2  # 특정 리비전으로
```

롤백하면 `DeploymentRollback` 이벤트가 기록된다(582~583행). 다음 판단 기준:

| 상태 | 판단 | 다음 행동 |
|---|---|---|
| rollout status 종료 코드 0 | 정상 완료 | 배포 유지, 변경 이력 기록 |
| 진행 중이지만 정체(ImagePullBackOff 등) | 템플릿 오류 가능성 | describe로 원인 확인 후 undo 검토 |
| ProgressDeadlineExceeded | 진행 마감 초과 | 원인 제거 또는 undo |
| Available이지만 일부 기능 오류 | 앱 레벨 문제 | 이 런북 범위 밖 — 앱 로그·데이터 확인 |

## 5단계 — 복구 후 확인

```shell
kubectl rollout status deployment/nginx-deployment
kubectl get deployment nginx-deployment
kubectl describe deployment nginx-deployment
```

`READY 3/3`과 `Progressing: True, NewReplicaSetAvailable`을 확인한다(585~594행, 621~627행).

## 롤백의 한계 — 반드시 알아야 할 것

- 롤백은 **Pod template만** 되돌린다. 데이터베이스 쓰기 같은 애플리케이션 데이터는 복원되지 않는다(392~399행).
- 리비전은 Pod template(`.spec.template`)이 바뀔 때만 만들어진다. scaling 같은 다른 변경은 리비전을 만들지 않는다(174~177행, 393~396행).
- `.spec.revisionHistoryLimit`(기본 10)은 남길 이전 ReplicaSet 수다. **0으로 설정하면 롤백할 수 없다**(1091~1098행). 정리는 Deployment가 complete 상태에 도달한 뒤에 시작되고, 완료되지 못한 Deployment는 한도보다 많은 ReplicaSet을 가질 수 있다(1100~1108행).
- paused 상태에서는 롤백이 진행되지 않는다. 여러 템플릿 수정을 모아 적용하려고 pause한 경우 재개 후에 판단해야 한다(1084~1087행의 failed deployment 조작 참고).

## 작업 전·후 체크리스트

작업 전:
- [ ] `kubectl config current-context`로 대상 클러스터·네임스페이스를 확인했다.
- [ ] `rollout history`로 되돌아갈 리비전 번호를 확인했다.
- [ ] revisionHistoryLimit이 0이 아닌지 확인했다.
- [ ] 롤백으로 되돌려지는 것이 Pod template뿐임을 팀에 공유했다.

작업 후:
- [ ] `rollout status` 종료 코드 0을 확인했다.
- [ ] `get deployment`에서 READY 수가 의도와 일치하는지 확인했다.
- [ ] `describe`의 Conditions에서 `NewReplicaSetAvailable`을 확인했다.
- [ ] 실패 원인과 조치를 이력으로 남겼다.
