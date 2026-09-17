
- 수동 tar 배포를 GitHub Actions·GHCR·self-hosted runner 파이프라인으로 바꾼 기록이고, 지금 이 파이프라인은 배포만 하지 않고 PostgreSQL 백업과 위키 콘텐츠 시드까지 돌린다.
- 롤백은 revision 기반 rollout undo 를 못 쓴다 — base manifest 의 이미지가 전부 :local 이라 apply 하는 순간 중간 revision 이 오염되기 때문에, 배포 전에 캡처한 이미지 파일로 복구하기로 했다.
- main push 마다 verify(2026-08-19 기준 Spring 246개·web 118개·lint 경고 7개) → build(이미지 5개) → deploy 가 직렬로 돌고 공개 스모크 curl 7개로 끝나는 것을 확인했다. ~~실제 롤백 리허설은 아직 하지 않았다.~~ (2026-08-19 정정: 없는 이미지로 깨뜨려 [스크립트를 직접 태웠다](/wiki/image-that-never-pulled) — 복구 9초, 공개 요청 실패 0건)

처음 miniPC 배포는 tar 이미지 방식이었다. 한 번 성공시키기에는 좋았지만 반복 배포에는 맞지 않았다.
GitHub-hosted runner 가 밖에서 SSH 로 들어오는 안은 Cloudflare Access 인증과 얽혀 일찍 접었다 —
당시 판단이고 재현 로그가 저장소에 남아 있지는 않다. 대신 miniPC 안에 runner 를 서비스로 띄우면
GitHub 가 job 을 보내고 miniPC 가 내부에서 kubectl 을 실행한다. 실제로 deploy 잡은
self-hosted·linux·x64·minipc 라벨로 붙고 첫 단계가 kubectl get nodes 다.

## 전환한 구조 — 세 갈래가 아니라 세 단의 직렬이다

~~~mermaid
flowchart TB
    Push[main push + 경로 필터] --> Verify[verify: spring, web, payment-api, shipping-api, partner-simulator]
    Verify --> Build[build: 이미지 6개를 SHA와 main 태그로 GHCR push]
    Build --> Deploy[deploy: miniPC self-hosted runner]
    Deploy --> Capture[Deployment 이미지 캡처]
    Capture --> Rollout[base manifest apply + rollout]
    Rollout --> Ops[PostgreSQL 백업 + 위키 콘텐츠 시드]
    Ops --> Smoke[공개 스모크 curl 7개]
~~~

이 절은 세 군데가 틀렸었다. 옛 서술을 지우지 않고 남긴다.

- 예전 그림 ~~Actions 가 테스트·GHCR push·runner 세 갈래 병렬로 갈라진다~~
  - 2026-08-13 정정: verify → build(needs: verify) → deploy(needs: build) 직렬 3잡 체인이다.
- 검증 잡 ~~Spring test + web build~~
  - 2026-08-13 정정: 네 덩어리다 — Spring test, web(npm ci·lint·type-check·test·build),
    payment-api(ruff·basedpyright·pytest), partner-simulator(같은 셋).
- 이미지 빌드 ~~GHCR image push 한 칸~~
  - 2026-08-13 정정: backend·web·payment-api·partner-simulator·opensearch 다섯 이미지를
    전부 linux/amd64 로 빌드해 각각 :SHA 와 :main 두 태그로 push 한다.

배포는 항상 immutable SHA 태그로 한다.

concurrency 그룹이라 배포가 겹치지도, 진행 중 배포가 취소되지도 않는다. 브랜치 보호는 무료 플랜 +
비공개 저장소라 걸 수 없어서, develop → main 머지로만 배포한다는 규칙은 구조가 아니라 규율로만 지켜진다.

## 막힌 지점 — pull secret, runner 중복, 플랫폼 셋이다

| 문제 | 원인 | 해결 |
|---|---|---|
| GHCR pull 실패 | pull token secret 누락 | GHCR_PULL_TOKEN 으로 ghcr-pull secret 생성 |
| runner conflict | nohup runner 와 systemd runner 중복(당시 메모 기준) | 임시 runner 종료, service runner 유지 |
| 이미지 플랫폼 문제 | local/arm64 와 k3s/amd64 혼동(당시 메모 기준) | linux/amd64 기준 빌드로 고정 |

push 인증과 pull 인증이 다른 토큰인 것도 여기서 배웠다. push 는 워크플로의 GITHUB_TOKEN 에
packages: write 권한을 주면 되지만, 클러스터의 pull 은 별도의 GHCR_PULL_TOKEN 으로 만든 ghcr-pull
secret 을 backend·frontend·data 세 네임스페이스에 깔아야 했다. 네 Deployment 전부 이걸 쓴다.

## 앞으로 갈 수는 있는데 돌아올 수는 없었다

rollout status 는 새 Pod 가 Ready 인지만 본다. Pod 는 떴는데 공개 경로가 깨진 경우, 스모크가 실패해도
교체된 이미지는 그대로 남았다.

처음에는 kubectl rollout undo 로 revision 을 되돌리면 될 줄 알았다. 안 됐다. base manifest 네 개의
image 가 전부 :local 이라, 배포가 manifest 를 apply 하는 순간 중간 revision 이 :local 로 찍힌다.
undo 는 그 오염된 revision 으로 돌아간다.

그래서 배포 시작 직후, Deployment 를 건드리기 전에 다섯
Deployment(jaywiki·payment-api·shipping-api·partner-simulator·web)의 현재 이미지를 파일로 캡처해 두고,
실패하면 그 파일로 복구한다. 캡처 스크립트는 이미지가 3개에서 5개 사이일 때만 정상으로 인정하고
아니면 배포 변경 전에 중단한다 — 새 서비스가 처음 배포되는 판에서는 그 서비스만 아직 안 잡힌다.

실패 지점에 따라 경로가 갈린다.

| 실패 지점 | 동작 |
|---|---|
| 이미지 캡처 전 | Deployment 를 아직 안 바꿨으므로 롤백하지 않는다 |
| application rollout 실패 | 배포 스크립트의 trap ERR 이 진단 덤프를 찍은 뒤 캡처 파일로 복구 |
| 그 밖의 캡처 이후 실패(OpenSearch Helm, 스모크 포함) | 워크플로의 별도 롤백 스텝이 같은 캡처 파일로 복구 |

이 표도 예전 판에서 두 행이 틀렸었다.

- 첫 행 ~~OpenSearch Helm 실패는 atomic upgrade 가 직전 release 로 복구하고 끝~~
  - 2026-08-13 정정: 캡처가 OpenSearch 배포보다 앞서므로, Helm --atomic 이 먼저 되돌린
    뒤에도 workflow 롤백 스텝에 함께 걸린다.
- 마지막 행 ~~스모크가 실패하면 같은 캡처 파일로 복구하고 끝~~
  - 2026-08-13 정정: application rollout 실패는 배포 스크립트의 trap ERR 이 진단 덤프
    (pod 상태·describe·현재/이전 컨테이너 로그·최근 이벤트)를 찍은 뒤 복구를 부르고,
    그 밖의 캡처 이후 실패는 워크플로의 별도 롤백 스텝이 부른다.

롤백 스크립트 자신도 복구 후 각 Deployment 의 현재 이미지를 출력하고 홈과 board API 를
curl 로 다시 쳐서 rollback verified 를 찍는다.

## 배포가 배포만 하지 않는다

이 글에 오래 빠져 있던 사실인데, deploy 잡은 이미지 교체가 끝나면 운영 데이터를 두 번 건드린다.

먼저 **PostgreSQL 백업을 강제로 한 번 돌린다.** cronjob/jaywiki-postgres-backup 에서 Job 을 만들어
완료를 300초까지 기다린다. 콘텐츠를 덮어쓰기 직전 상태가 항상 백업으로 남는다는 뜻이다.

그 다음 **위키 콘텐츠 시드를 클러스터 안에서 실행한다.** seed-portfolio-wiki.mjs 를 ConfigMap 으로
말아 node:24-alpine Job(backoffLimit 0, 데드라인 300초)으로 돌리고, 편집자는 gitops:<커밋 SHA 앞
12자>로 기록된다. 위키 글이 develop → main 머지만으로 화면에 반영되는 이유가 이 단계다.

마지막이 공개 스모크 curl 7개다: 홈, /chat, board·chat state API, Saga 주문 생성(POST), /kafka/order,
partner-api-resilience 시나리오. Saga 주문은 커밋 SHA 를 멱등키로 써서 재실행해도 중복되지 않는다.

## timeout과 lint를 남겼고, PR 검증에 구멍이 남았다

- 모든 잡에 timeout-minutes 가 있다. self-hosted runner 가 무한히 매달리지 않는다.
- 웹에 lint 단계가 생겼다. eslint --max-warnings 7 이라 경고 하나만 늘어도 빌드가 깨진다.
  - 예전 서술 ~~--max-warnings 8~~
    - 2026-08-19 갱신: 경고 하나를 없애고 상한을 7 로 내렸다. 남은 7 은 전부 react-hooks/set-state-in-effect 다.
- 예전 서술 ~~수동 tar 배포는 emergency override 로 남긴다~~
  - 2026-08-13 정정: 지금 build-images-tar.sh 는 backend·web·payment-api 세 이미지만 만들어
    partner-simulator 와 OpenSearch nori 가 빠진다. 이 경로로는 현재 스택을 재현할 수 없다.
- PR 용 ci.yml 은 spring·web·payment-api 3잡뿐이라 partner-simulator 는 main push 후 deploy 의
  verify 에서 처음 검증된다. PR 단계의 구멍이다.
- **실제 롤백 리허설은 아직 하지 않았다.** 스크립트는 있지만 운영에서 한 번 되돌려 보고 그 기록을
  남기기 전까지는 이 글에 성공했다고 쓰지 않는다.
