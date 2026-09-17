# 배포 실패 때 펼치는 Deployment 롤백 런북

이 문서는 Kubernetes Deployment를 처음 운영하는 당직 개발자가 배포 실패를 만났을 때 순서대로 확인할 런북이다. 전제는 `kubectl`로 클러스터에 닿을 수 있고, 대상 Deployment의 이름과 namespace를 알고 있다는 것이다. 예시는 공식 문서의 nginx-deployment를 쓰며, 실제 운영 환경에서 실행한 기록이 아니다. 애플리케이션 데이터베이스 복구와 클러스터 장애 대응은 이 문서의 범위가 아니다. 클러스터 context와 namespace를 먼저 확인하라는 것은 문서의 명령이 아니라 작성자의 안전 권고이다. 확인되지 않은 운영 값은 `<...>` placeholder로 둔다.

## 배포 상태 확인부터 복구 판단까지

먼저 롤아웃이 어디까지 갔는지 본다. 아래 명령은 상태를 묻는 것으로, 다음 판단의 재료가 된다.

```shell
kubectl rollout status deployment/<deployment> -n <namespace>
kubectl get deployment <deployment> -n <namespace>
```

멈춰 있으면 Pod 쪽에서 원인을 관찰한다. 할당량 부족, readiness probe 실패, 이미지 pull 오류, 권한 부족, limit range, 애플리케이션 설정 오류가 흔한 원인이다.

```shell
kubectl get pods -n <namespace> -l <selector>
kubectl describe deployment <deployment> -n <namespace>
```

새 Pod만 멈춰 있고 기존 Pod이 살아 있다면, 컨트롤러가 maxUnavailable 범위 안에서 나쁜 롤아웃을 멈춘 상태일 수 있다. 되돌리기 전에 돌아갈 곳이 있는지도 본다.

```shell
kubectl rollout history deployment/<deployment> -n <namespace>
kubectl rollout history deployment/<deployment> -n <namespace> --revision=<N>
```

CHANGE-CAUSE가 비어 있으면 어떤 변경이었는지 알 수 없으니 평소에 변경 사유를 남긴다. `--record` 플래그는 deprecated이므로 쓰지 않는다.

## 상태와 판단과 다음 행동

진행 실패 감지와 자동 롤백은 같은 것이 아니다. 기한을 넘기면 컨트롤러는 `ProgressDeadlineExceeded` 상태만 보고할 뿐 이전 버전으로 자동 롤백하지 않는다. 아래 표로 갈 길을 정한다.

| 상태 | 판단 | 다음 행동 |
|---|---|---|
| 새 Pod만 멈춤, 돌아갈 리비전 있음 | 나쁜 롤아웃 | 이전 리비전으로 undo |
| 새 Pod만 멈춤, 돌아갈 리비전 없음 | 복구 수단 없음 | 원인 수정 후 새 롤아웃 |
| 전체 멈춤, 원인 불명 | 추가 관찰 필요 | describe·이벤트 확인 후 판단 |
| 기한 초과 보고됨 | 자동 복구 아님 | 사람이 복구 판단 |

되돌리기는 Pod 템플릿 부분만 되돌린다. 스케일 변경은 리비전을 만들지 않으므로 롤백 대상이 아니다. 애플리케이션 데이터 복구는 별개이며, 되돌리기 명령이 있다고 데이터까지 돌아오지 않는다.

```shell
kubectl rollout undo deployment/<deployment> -n <namespace>
kubectl rollout undo deployment/<deployment> -n <namespace> --to-revision=<N>
```

되돌린 뒤에는 끝났다고 단정하지 않고 반드시 숫자로 확인한다.

```shell
kubectl get deployment <deployment> -n <namespace>
kubectl describe deployment <deployment> -n <namespace>
```

## 지켜야 할 제약 두 가지

첫째, 이력 보관 제한이다. `.spec.revisionHistoryLimit`(기본 10)을 넘긴 오래된 ReplicaSet은 정리되며, 0으로 두면 롤백할 수 없다. 정리는 완료 상태에 이른 뒤에 시작하므로, 끝나지 않은 롤아웃이 쌓이면 제한보다 많은 ReplicaSet이 남을 수 있다. 둘째, 멈춤 상태이다. 멈춘 Deployment는 resume하기 전에는 되돌릴 수 없다. 멈춤 중에 바꾼 Pod 템플릿은 resume 전에는 롤아웃을 일으키지 않는다.

## 작업 전후 체크리스트

작업 전: context와 namespace가 당직 대상과 같은지, 대상 이름과 돌아갈 리비전 번호를 적었는지, 이력 보관 제한 값을 확인했는지, Deployment가 paused 상태가 아닌지 확인한다. 작업 후: 복제본 숫자와 Pod 상태, describe 조건과 이벤트, 애플리케이션 동작 점검 결과를 기록한다. 기록에는 실제 출력이 아니라 확인한 항목과 판단 근거를 남긴다.
