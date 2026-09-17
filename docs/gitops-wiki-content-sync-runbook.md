# GitOps 위키 콘텐츠 동기화 runbook

## 목적

`scripts/seed-portfolio-wiki.mjs`의 검토된 tab·article을 운영 PostgreSQL과 동기화한다. 관리자 로그인과 TOTP를 우회하지 않고,
별도 machine token이 허용하는 upsert 두 종류만 Kubernetes 내부 Job에서 실행한다.

## 보안 경계

- public BFF에는 `/internal/content-sync/**` proxy가 없다.
- Spring Service는 `ClusterIP`이며 내부 endpoint는 token 오류와 미설정을 모두 `404`로 처리한다.
- `APP_CONTENT_SYNC_TOKEN`은 `backend/jaywiki-secrets`에만 저장한다.
- runner는 token 값을 읽거나 출력하지 않고 Job의 `secretKeyRef`만 선언한다.
- Job은 `automountServiceAccountToken: false`로 Kubernetes API 자격 증명을 받지 않는다.
- 권한은 tab·article upsert뿐이다. delete, revert, user, board, asset API는 없다.

## 정상 배포 순서

1. GitHub Actions verify와 image build가 통과한다.
2. `scripts/ensure-content-sync-secret.sh`가 token 부재 시 32-byte 값을 만든다.
3. base manifest가 backend에 `APP_CONTENT_SYNC_TOKEN`을 주입한다.
4. backup CronJob manifest를 적용하고 immutable SHA image rollout을 완료한다.
5. `scripts/run-postgres-backup-now.sh`가 backup Job 완료와 로그를 확인한다.
6. `scripts/sync-wiki-content-k8s.sh`가 seed 파일 ConfigMap과 일회성 Job을 만든다.
7. Job은 현재 상태와 diff를 계산하고 변경분만 내부 endpoint로 upsert한다.
8. revision editor는 `gitops:<short-sha>`로 남는다.
9. Job 로그를 출력한 뒤 Job과 ConfigMap을 정리한다.
10. public smoke test가 통과해야 workflow가 완료된다.

## 수동 재실행

배포가 완료됐지만 콘텐츠 동기화만 재실행해야 할 때 miniPC repository checkout에서 실행한다.

~~~bash
GIT_SHA="$(git rev-parse HEAD)" scripts/sync-wiki-content-k8s.sh
~~~

먼저 운영 diff만 보고 싶으면 기존 Keychain 경로를 사용한다.

~~~bash
scripts/seed-production-wiki.sh
~~~

수동 관리자 write는 계속 `scripts/seed-production-wiki.sh --write`와 현재 TOTP를 사용한다.

## token 회전

1. 새 32-byte random token을 로컬 shell 변수로 만든다.
2. `backend/jaywiki-secrets.APP_CONTENT_SYNC_TOKEN`을 patch한다. 값을 echo하거나 shell history 인자로 넣지 않는다.
3. `kubectl -n backend rollout restart deployment/jaywiki`를 실행한다.
4. rollout 완료 뒤 현재 commit으로 sync Job을 실행한다.
5. no-op 또는 예상한 변경 수와 공개 문서 HTTP 200을 확인한다.

회전 중에는 backend와 Job이 같은 token을 보도록 Secret patch와 rollout 사이에 다른 sync를 실행하지 않는다.

## 실패 대응

| 증상 | 확인 | 조치 |
|---|---|---|
| endpoint 404 | backend env와 Job secretKeyRef, rollout 시각 | Secret key 확인 후 backend 재배포 |
| Job timeout | backend readiness, DNS, Job log | 원인 수정 후 같은 SHA로 재실행 |
| article validation 400 | seed 필드와 DTO 계약 | 코드에서 수정하고 review 후 재배포 |
| 예상 밖 대량 diff | seed와 운영 관리자 수정 비교 | write 중단, 콘텐츠 소유권 결정 |
| 잘못된 본문 반영 | revision과 배포 SHA | 관리자 revert 또는 후속 commit |
| backup Job 실패 | CronJob 존재, PVC, pg_dump log | sync를 진행하지 않고 backup부터 복구 |

## 공개 문서에 쓰지 않는 값

- `APP_CONTENT_SYNC_TOKEN` 값과 base64 표현
- 관리자 비밀번호, TOTP seed와 현재 코드
- DB·MinIO root 자격 증명
- kubeconfig와 runner 등록 token

구조, 권한 범위, token 길이, 회전 절차, 실패 결과와 검증 증거는 공개할 수 있다.
