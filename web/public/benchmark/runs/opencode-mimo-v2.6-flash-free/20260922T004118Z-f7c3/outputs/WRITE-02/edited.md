# Kubernetes Deployment 업데이트와 롤백 요약

## 업데이트는 Pod 템플릿이 바뀔 때만 롤아웃을 만든다

롤아웃과 새 revision은 `.spec.template`(이미지·라벨 등)이 갱신될 때만 생긴다. 복제본 수 확장·축소 같은 변경은 롤아웃도 revision도 만들지 않는다. 갱신은 `kubectl set image deployment/nginx-deployment nginx=nginx:1.16.1` 또는 `kubectl edit`로 수행하고, 진행 상황은 `kubectl rollout status`로 확인한다. 기본 롤링 전략은 최대 25% unavailable·25% surge이며, 새 파드가 충분히 올라오기 전에는 옛 파드를 죽이지 않는다.

진행 중인 롤아웃이 끝나기 전에 다시 갱신하면(rollover) 방금 올리던 ReplicaSet은 늙은 목록으로 넘어가 즉시 축소되고 새 것으로 갈아탄다. 라벨 셀렉터는 생성 후 immutable이라 `patch`·`edit`·`apply`로 고칠 수 없다. 바꾸려면 삭제 후 재생성해야 하고, 더 좁은 셀렉터로 재생성하면 옛 파드가 고아가 되어 새 ReplicaSet이 새로 만들어진다.

## 롤백 절차

히스토리는 기본으로 남아 언제든 롤백할 수 있다. `kubectl rollout history deployment/nginx-deployment`로 revision 목록을, `--revision=2`로 각 revision 상세를 확인한다. `CHANGE-CAUSE`는 `kubernetes.io/change-cause` 어노테이션에서 복사되며, 옛 `--record` 플래그는 폐기 예정이다.

롤백은 `kubectl rollout undo deployment/nginx-deployment`, 특정 revision은 `--to-revision=2`로 수행한다. 롤백 시 되돌아가는 것은 Pod 템플릿 부분뿐이다. 성공 여부는 `kubectl get deployment`의 READY와 `describe`의 revision 어노테이션으로 확인한다. 잘못된 이미지 타이포(`nginx:1.161`)로 롤아웃이 멈추는 전형적 사례는 이전 안정 revision으로 롤백해 고친다. 새 ReplicaSet 확대는 `maxUnavailable`(기본 25%)에 막혀 컨트롤러가 자동 중단한다.

## Deployment 상태 판독과 실패 대응

상태는 진행·완료·실패로 나뉜다. 진행 중에는 새 ReplicaSet 생성·확대/축소, 새 파드의 ready로 `Progressing=True`(NewReplicaSetCreated·ReplicaSetUpdated 등)가 기록된다. 완료는 전 파드 갱신·가용, 옛 파드 부재이며 `Progressing=True(NewReplicaSetAvailable)`, `kubectl rollout status` 종료 코드는 0이다.

실패는 쿼터 부족·readiness 실패·이미지 풀 오류·권한 부족 등에서 일어난다. `progressDeadlineSeconds`(기본 600)를 넘기면 `Progressing=False(ProgressDeadlineExceeded)`, `rollout status` 종료 코드는 1이다. K8s는 멈춘 배포에 상태 보고 외 아무것도 하지 않으므로, 상위 오케스트레이터가 롤백하는 식으로 대응한다. 쿼터를 스케일 다운이나 증액으로 해소하면 완료 조건으로 돌아온다. 일시 정지 중에는 진행 기한 초과 체크가 발생하지 않는다. 실패한 배포에도 스케일·롤백·일시정지는 그대로 적용할 수 있다.

## 일시정지는 resume하기 전에 롤백할 수 없다

`kubectl rollout pause`로 여러 수정을 롤아웃 없이 모은 뒤 `kubectl rollout resume`하면 새 ReplicaSet이 한 번에 올라온다. paused 동안의 템플릿 변경은 새 롤아웃을 유발하지 않으며 기존 상태로 계속 동작한다. 다만 **paused Deployment는 resume하기 전까지는 롤백할 수 없다.**

## revisionHistoryLimit가 롤백 가능성을 결정한다

히스토리는 통제하는 ReplicaSet에 저장된다. `.spec.revisionHistoryLimit`(기본 10)개의 옛 ReplicaSet만 남기고 나머지는 GC된다. 0으로 지정하면 히스토리가 전부 지워져 이후 롤백이 불가능하다. 정리는 배포가 complete 상태에 이른 뒤에 시작되며, crash loop로 완료가 안 되면 설정값보다 ReplicaSet이 더 많이 남을 수 있다. 옛 ReplicaSet이 삭제된 순간 해당 revision으로 돌아갈 수 없으므로, 배포 빈도와 안정성에 맞춰 값을 정해야 한다.
