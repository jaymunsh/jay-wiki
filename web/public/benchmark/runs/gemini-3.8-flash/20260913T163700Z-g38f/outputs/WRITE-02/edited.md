# Kubernetes Deployment 배포 실패 대응 및 롤백 운영 런북

## 1. 대상 및 비대상 범위

본 런북은 `nginx-deployment` 배포 실패 시 당직 엔지니어가 상태를 파악하고 롤백하기 위한 운영 지침이다. 공식 문서를 바탕으로 재구성한 지침이며 실제 클러스터 실행 기록이 아니다.

- **전제 및 안전 권고**:
  - 안전 권고: 작업 전 `[확인 필요: 대상 클러스터 컨텍스트 및 네임스페이스]`를 점검해 오작동을 방지한다.
  - 판단 기준: `[확인 필요: 서비스 정상 지연시간 및 오류율 기준]`
- **비대상 범위**:
  - Deployment Pod 템플릿 복구만 다룬다. DB 마이그레이션 역방향 복구 및 StatefulSet 등은 제외한다.

## 2. 배포 상태 확인 및 실패 원인 관찰

배포 직후 롤아웃 상태를 확인한다.

```shell
kubectl rollout status deployment/nginx-deployment
```

진행 정체 시 `Ctrl-C`로 중단하고 원인을 살핀다. 원인은 이미지 풀 실패, Readiness 프로브 실패, 쿼터 부족 등이다.

`.spec.progressDeadlineSeconds`(예: 600초) 초과 시 컨트롤러는 `type: Progressing`, `status: "False"`, `reason: ProgressDeadlineExceeded` 조건을 기록한다.
쿠버네티스는 정체 상태만 보고할 뿐 배포를 자동으로 롤백하지 않으므로 엔지니어의 수동 개입이 필수적이다.

## 3. 리비전 이력 확인과 롤백 제약 검토

롤백 대상 리비전을 확인하기 위해 이력을 조회한다.

```shell
kubectl rollout history deployment/nginx-deployment
kubectl rollout history deployment/nginx-deployment --revision=2
```

`CHANGE-CAUSE`는 `kubernetes.io/change-cause` 어노테이션에서 복사된다. 과거 `--record` 플래그는 deprecated 되었다.

롤백 전 세 가지 제약을 확인한다.
1. **Paused 제약**: Deployment가 pause 상태이면 재개(`kubectl rollout resume`) 전까지 롤백할 수 없다.
2. **보관 한도**: 리비전은 ReplicaSet에 저장된다. 한도 초과로 ReplicaSet이 삭제되었거나 `revisionHistoryLimit`가 0이면 롤백이 불가하다.
3. **데이터 복구 불가**: 롤백은 Pod 템플릿만 되돌린다. replicas 수치나 DB 데이터는 복구되지 않는다.

| 상태 | 판단 | 다음 행동 |
| :--- | :--- | :--- |
| `ProgressDeadlineExceeded` 발생 | 배포 정체 확인. 자동 롤백 없음 | 롤아웃 중단 및 정상 리비전 조회 |
| `.spec.paused`가 true | 일시 정지로 롤백 불가 | 원인 확인 후 `kubectl rollout resume` 실행 |
| 대상 ReplicaSet 삭제됨 | 보관 한도 초과로 롤백 불가 | 롤백 중단 및 신규 핫픽스 배포 |
| 롤백 대상과 DB 비호환 | 데이터 손상 위험 | 롤백 보류, DB 복구 절차 병행 |

## 4. 롤백 수행 및 단계별 복구 절차

검토 후 대상 리비전으로 롤백한다.

- **직전 리비전으로 롤백**:
```shell
kubectl rollout undo deployment/nginx-deployment
```
목적: 직전 안정 버전으로 즉시 복구한다.

- **특정 리비전 지정 롤백**:
```shell
kubectl rollout undo deployment/nginx-deployment --to-revision=2
```
목적: 검증된 특정 리비전(2번)으로 정확히 복구한다.

## 5. 복구 후 확인 및 작업 전·후 체크리스트

롤백 후 배포 정상화 여부를 확인한다.

```shell
kubectl rollout status deployment/nginx-deployment
kubectl get deployment nginx-deployment
```

- **작업 전 체크리스트**:
  - `[ ]` 클러스터 Context와 Namespace가 대상과 일치하는가?
  - `[ ]` Deployment가 Paused 상태가 아닌가? (Paused면 resume 선행)
  - `[ ]` 롤백 대상 ReplicaSet이 실제로 존재하는가?
  - `[ ]` 이전 버전 코드가 현재 DB 데이터와 호환되는가?

- **작업 후 체크리스트**:
  - `[ ]` `kubectl rollout status`가 성공으로 종료되었는가?
  - `[ ]` `UP-TO-DATE` 및 `AVAILABLE` 수가 목표치와 일치하는가?
  - `[ ]` 신규 Pod들이 정상 Running 상태인가?
  - `[ ]` 서비스 헬스체크 및 에러율이 정상화되었는가?
