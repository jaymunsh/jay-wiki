---
title: "배포는 머지 한 번이고, 그 한 번이 어디까지 하는지 정해 둔다"
slug: deploy-rules-and-harness
tab: "운영·관측"
parentId: operations
sortOrder: 9
kind: wiki
tags: deployment,github-actions,k3s,rollback,operations,release
source: scripts/seed-portfolio-wiki.mjs
---
- 이 저장소에서 배포는 develop 을 main 에 머지하는 행동 하나이고, 그 뒤는 파이프라인이 사람 없이 끝까지 간다.
- 머지 한 번에 걸리는 것과 안 걸리는 것의 경계를 정해 뒀다 — 경로 필터가 배포를 부르고, 파이프라인 밖에 남은 것은 Secret 값·릴리스 첫 설치·차트 버전 올리기뿐이다(2026-08-16 기준).
- deploy.yml 의 verify → build → deploy 세 잡, 스모크 curl 일곱 개와 /sync 404 확인 둘, 이미지 캡처 기반 롤백으로 확인 지점을 고정해 뒀다.

## 결론 — 배포는 머지 한 번이고, main 직접 push 는 없다

작업은 전부 develop 에 모은다. 기본 브랜치가 develop 이다. 그리고 **develop 을 main 에 머지하는 행동이 곧 배포다.** main 에 push 가 들어오는 순간 파이프라인이 테스트·빌드·rollout 까지 사람 없이 간다. 그래서 main 에 직접 push 하지 않고, 새 작업은 develop 에서 딴다.

이 규칙은 구조가 아니라 규율로만 지켜진다. 무료 플랜 + 비공개 저장소라 브랜치 보호를 걸 수 없다(API 가 403 을 준다). main 을 막는 장치가 저장소에 없으므로, "배포 = 머지"라는 정의를 문서와 습관으로 붙들고 있는 셈이다.

- 예전 서술 ~~main 을 막는 장치가 저장소에 없으므로, 문서와 습관으로 붙들고 있는 셈이다~~
  - 2026-08-13 정정: main 을 막는 장치가 저장소 안에 하나 생겼다. .claude/settings.json 의 PreToolUse 훅이 main 직접 push 를 거부한다. 다만 브랜치 보호가 생긴 것은 아니고, 원격은 여전히 main push 를 받는다.

배포가 겹치는 경우는 워크플로 쪽에서 잡았다. concurrency 그룹이 jaywiki-production 하나이고 cancel-in-progress 가 false 라, 배포가 겹치면 뒤엣것이 취소되지 않고 줄을 선다.

지금 파이프라인이 어떻게 이 모양이 됐는지 — 수동 tar 배포에서 옮겨 온 경위 — 는 cicd-ghcr-runner 에 있다. 이 글은 그 전환의 결과로 **지금 무엇을 지켜야 하는가**만 적는다. 배포 전체를 한 장으로 훑는 그림은 all-in-one-deploy-build 에 있다.

## 왜 그렇게 했나 — 배포를 한 동작으로 좁혀야 확인 지점이 고정된다

배포가 여러 동작(빌드하고, 올리고, 시드 돌리고, 확인하고)으로 흩어져 있으면 어느 단계를 빠뜨렸는지 사람이 기억하는 수밖에 없다. 머지 한 번으로 좁히면 반대가 된다 — 머지 뒤에 일어나는 일의 목록이 deploy.yml 한 파일에 고정되고, 사람은 그 목록이 끝까지 돌았는지만 본다.

대신 그 한 번이 **어디까지 하는지**를 정확히 알아야 한다. 경계가 흐리면 두 가지 착각이 난다. 하나는 "머지했으니 반영됐겠지"(경로 필터에 안 걸리거나 파이프라인 밖인 경우), 다른 하나는 "이건 따로 올려야지"(사실 파이프라인이 이미 하는 경우). 아래 실제 구성은 그 경계를 그대로 적은 것이다.

## 무엇이 배포를 부르나 — 경로 필터가 먼저 거른다

main push 가 전부 배포로 이어지지는 않는다. 경로 필터가 있다. .github/workflows/deploy.yml, infra/k8s/\*\*, infra/opensearch/\*\*, scripts/\*\*, services/payment-api/\*\*, services/shipping-api/\*\*, services/partner-simulator/\*\*, spring/\*\*, web/\*\* 이 바뀔 때만 돈다. 그래서 docs/ 나 posts/ 만 고친 커밋은 main 에 가도 배포가 안 걸린다.

workflow_dispatch 로 손으로 돌릴 수도 있고, 이때 data_releases 입력에 릴리스 이름(pg redis minio)을 적으면 데이터 계층 Helm 을 그 판에서 같이 올린다 — 첫 판(2026-08-16)을 이 입력으로 사람이 지켜보며 돌렸다.

여기서 나오는 규칙 하나 — **위키 글은 두 번 머지해야 화면이 바뀐다.** 배포가 시드를 실행하므로 develop 까지만 가면 운영에 안 나간다.

- 예전 서술 ~~블로그 글은 원래 배포와 무관하다. 사람이 발행 스크립트를 돌린다~~
  - 2026-08-16 정정: 블로그 초안도 배포가 올린다. 위키 콘텐츠 싱크 바로 다음 단계에서 publish-blog-drafts-k8s.sh 가 돈다. 백업에서 글을 되돌리는 리허설을 마친 뒤에야 켰다(BLOG_PUBLISH_AUTO). 그 결정의 경위는 deploy-automation-boundary 에 있다.

반대로 **코드가 안 바뀌고 글만 고쳤다면 배포 한 판을 다 돌릴 필요가 없다.** 로컬 개발 서버 전용 /sync 판이 scripts/content-ops.mjs 의 같은 함수(check, sync-wiki, sync-blog, publish-wiki, publish-blog)를 버튼으로 부른다. 운영에서는 페이지도 API 도 404 이고, 그 404 를 배포 스모크가 매번 확인한다 — 열려 있으면 인증 없이 글을 쓰는 문이 되기 때문이다. 단 새 이미지 파일이 있으면 이 문은 막힌다. 그림은 web 컨테이너 안에 있어서 배포가 있어야 뜬다.

## 머지 전에 걸리는 검증 — PR 은 ci.yml, 예외는 partner-simulator 다

PR 에는 ci.yml 이 붙는다. spring 테스트 / web(lint·type-check·test·build) / payment-api·shipping-api(각각 ruff·basedpyright·pytest) 네 잡이다. partner-simulator 는 PR 검증에 없다. main 에 들어간 뒤 deploy 의 verify 잡에서 처음 돌아간다.

로컬 기준선은 spring 테스트 246개, web 테스트 118개, tsc 통과, lint 경고 정확히 7개다. eslint 가 --max-warnings 7 이라 경고 하나만 늘어도 빌드가 깨진다.

## main push 뒤에는 잡 셋이 직렬로 돈다

verify → build → deploy 순서다. 앞이 실패하면 뒤가 안 돈다.

~~~mermaid
flowchart TB
    V[verify - 테스트 다섯, ubuntu-latest, 20분 제한] --> B[build - 이미지 여섯 개를 GHCR 에, 30분 제한]
    B --> D[deploy - miniPC self-hosted runner, production, 25분 제한]
~~~

- **verify**: Spring 테스트, web(lint·type-check·test·build), payment-api·shipping-api(각각 ruff·basedpyright·pytest), partner-simulator(같은 셋). 콘텐츠 쪽도 여기서 본다 — 위키 시드 정합성(--seed-only), 블로그 내부 링크, 그리고 마크다운 export 가 시드와 같은지(git diff --exit-code). ubuntu-latest 에서 돈다.
- **build**: 이미지 여섯 개를 GHCR 에 올린다 — backend, web, payment-api, shipping-api, partner-simulator, OpenSearch nori. 태그는 커밋 SHA 고정과 main 두 개다.
- **deploy**: miniPC 안의 self-hosted runner 에서 돈다. environment 는 production 이다.

모든 잡에 timeout-minutes 가 있다(verify 20, build 30, deploy 25). runner 가 무한히 매달리지 않는다.

## deploy 잡이 하는 일의 순서 — 이게 머지 한 번이 하는 전부다

2026-08-15 에 관측 스택 Helm 이, 2026-08-16 에 데이터 계층 Helm(조건부)·빈 탭 삭제·블로그 발행이 이 목록에 들어왔다. 지금은 열여섯 단계다.

1. kubectl get nodes 로 접근을 확인한다
2. 네임스페이스를 apply 한다
3. Secret 넷을 보장한다 — GHCR pull, 파트너 콜백, 콘텐츠 동기화, MinIO 자격증명
4. **관측 스택 Helm 여섯(prom·graf·loki·tempo·promtail·otel)을 올린다.** 이미지 캡처보다 앞이다 — 여기서 실패해도 앱은 아직 안 건드린 상태고, --atomic 이 실패한 릴리스만 되감는다
5. 파이프라인이 안 다루는 변경을 감지한다 — 데이터 계층 values 가 이 커밋에서 바뀌었는지 git diff 로 본다
6. **(조건부) 데이터 계층 Helm(pg·redis·minio)을 올린다.** values 가 바뀐 배포에서만, DATA_HELM_AUTO=true 일 때만 돈다. 비밀번호는 그 릴리스가 지금 쓰는 클러스터 Secret 에서 읽어 되돌려 넣고, 차트 버전이 깔린 것과 다르거나 릴리스가 없으면 스크립트가 멈춘다
7. **지금 도는 이미지를 파일로 캡처한다.** 롤백이 이 파일에 걸린다
8. base manifest 를 apply 한다 — Kafka, pg-services, RBAC, payment-api, shipping-api, partner-simulator, 백엔드, HPA, 백업 CronJob, 프런트엔드
9. MinIO 에 포트폴리오 스택 자산과 벤치마크 증적을 올린다
10. OpenSearch nori 이미지를 반영한다
11. **이미지를 교체한다** — SHA 고정 태그로 kubectl set image
12. **콘텐츠 반영 전에 PostgreSQL 을 백업한다.** 이 백업 하나가 위키 시드와 블로그 발행을 같이 덮는다
13. 위키 콘텐츠를 시드한다. 정본에 없는 **빈** 탭은 여기서 지운다 — 글이 든 탭은 서버가 409 로 거부하고, 한 번에 둘까지만 지운다
14. **블로그 초안을 발행한다**(BLOG_PUBLISH_AUTO=true). 클러스터 안 Job 이 위키와 같은 내부 문으로 넣고, 무엇이 바뀌었는지는 서버가 판단해 안 바뀐 글은 저장하지 않는다
15. 스모크를 친다 — 공개 curl 일곱 개(첫 화면, /chat, 게시판 BFF, 채팅 상태, Saga 주문의 배송 실패 시나리오, Kafka 데모 화면, 파트너 API 시나리오 화면)와, /sync·/api/sync 가 운영에서 404 인지 확인 둘
16. 실패하면 롤백하고, helm list -A 로 클러스터 릴리스 목록을 로그에 남기고, 텔레그램으로 통보한다

## 롤백은 rollout undo 가 아니라 캡처한 이미지로 한다

base manifest 의 image 가 전부 :local 자리표시자다. 그것을 apply 하는 순간 중간 revision 이 오염되므로 revision 기반 kubectl rollout undo 를 쓸 수 없다.

그래서 배포 전에 캡처해 둔 이미지 파일로 kubectl set image 해서 되돌리고, rollout status 로 기다린 다음, 공개 스모크 두 개(첫 화면과 게시판 BFF)로 확인한다. 롤백은 이미지 캡처가 성공한 뒤의 어떤 단계에서 실패하든 돈다. 같은 스크립트를 수동 롤백 리허설에도 쓰도록 만들어 뒀다.

## 파이프라인 밖에 있는 것 — 자주 착각하는 자리

- 예전 서술 ~~관측 스택은 Helm 이라 사람이 miniPC 에서 직접 올린다. 파이프라인 안에 있는 데이터 계층은 Kafka 뿐이다~~
  - 2026-08-15 정정: 관측 스택 Helm 여섯이 배포 잡에 들어왔다. 알림 규칙이나 대시보드를 고쳐 main 에 머지하면 이제 운영에 나간다.
  - 2026-08-16 정정: 데이터 계층 Helm(pg·redis·minio)도 조건부로 들어왔다. values 가 그 커밋에서 바뀐 배포에서만 돈다. 경계를 옮긴 근거는 deploy-automation-boundary 에 있다.

그래서 지금 파이프라인 밖에 남은 것은 성질이 다른 셋이다.

| 사람 몫으로 남은 것 | 왜 |
|---|---|
| Secret 의 실제 값 | 저장소에 없다. 배포는 있는 Secret 을 보장할 뿐 값을 만들지 못한다 |
| Helm 릴리스의 첫 설치 | 스크립트는 없는 릴리스를 만나면 설치하지 않고 멈춘다 |
| 차트 버전 올리기 | 값을 바꾸는 것과 다른 작업이다. 깔린 버전과 다르면 스크립트가 거부한다 |

워크로드 매니페스트의 image 가 :local 인 것도 자리표시자다. 실제 이미지는 배포 스크립트가 SHA 태그로 갈아 끼운다. 저장소만 보고 운영 상태를 읽으면 Secret 값과 이 자리에서 어긋난다.

## 배포 뒤에도 사람이 확인하는 자리가 남아 있다

- 텔레그램 배포 알림이 온다. 성공·실패·취소가 갈리고, 롤백이 돌았으면 제목에 실린다
- 파드가 떴는지 본다
- 관리자 화면이 보이는지 본다 — /api/admin 이 ADMIN 으로 닫혀 있어 스모크가 못 보는 자리다
- check-wiki-consistency.mjs 와 check-content-sync.mjs 를 돌린다. 운영을 불러야 아는 유령 글·탭과 로컬-운영 본문 어긋남은 여전히 사람이 배포 뒤에 확인한다

## 규칙을 문서가 아니라 저장소에 심었다

같은 규칙을 세 층으로 내렸고, 층마다 성격이 다르다. CLAUDE.md 는 매 세션 항상 읽히고, 스킬은 말에 걸릴 때 본문이 열리고, 훅은 말과 무관하게 기계적으로 돈다.

CLAUDE.md 의 배포 표 아래에는 deploying 스킬을 먼저 열라는 줄을 뒀다. .claude/skills/deploying/SKILL.md 는 배포·서버에 반영·운영에 올려·취합해줘 같은 말에 걸린다. 첫 지시는 docs/deploy-runbook.md 를 읽는 것이고, 강제하는 것은 일곱이다 — 배포인지 먼저 가른다, main 머지 전에 사용자 확인을 받는다, main 에 직접 push 하지 않는다, 머지 전에 기준선을 돌린다, 이번 변경이 파이프라인 밖인지 먼저 말한다, 배포 후 확인까지가 배포다. 런북은 명령이 들어간 순서다 — 나가는 커밋 확인, 기준선, 파이프라인 밖 판별, PR 과 머지, 진행 지켜보기, 배포 후 공개 API 검증, 실패했을 때.

말에 안 걸리면 스킬은 안 열린다. 그래서 꼭 막아야 하는 하나만 훅으로 내렸다. .claude/settings.json 의 PreToolUse 훅이 scripts/guard-main-push.sh 를 부르고, 이 가드는 main 을 향한 push 만 거부한다. origin main, HEAD:main, develop:main 같은 명시형과, 인자 없는 git push 를 현재 브랜치가 main 일 때 잡는다. develop push 는 그대로 나간다. 2026-08-13 에 git push origin main --dry-run 이 실제로 거부되는 것과 develop push 가 통과하는 것을 둘 다 확인했다. 배포는 push 가 아니라 PR 머지라 이 가드가 배포를 막지 않는다.

셋 다 저장소에 커밋돼 있어 이 저장소를 받은 어느 세션에서나 같이 온다. 다만 이것은 브랜치 보호가 아니다. 원격은 여전히 main push 를 받는다. 이 가드가 보는 것은 이 저장소에서 도는 에이전트의 셸 호출뿐이고, 사람이 터미널에 직접 치는 것은 막지 못한다.

## 한계 — 남은 롤백 경로와 브랜치 보호

- **워크플로 스텝 실패와 ImagePullBackOff 롤백은 운영에서 검증했다.** 각각 2026-08-16, 2026-08-19에 이전 이미지 복구와 공개 화면 정상 응답을 확인했다. 남은 것은 readiness는 통과하지만 실제 기능이 깨진 이미지 경로다.
- 브랜치 보호가 없다. main 직접 push 를 막는 것은 규율뿐이다.
- 데이터 계층 Helm 과 블로그 발행의 스위치(DATA_HELM_AUTO, BLOG_PUBLISH_AUTO)는 코드가 아니라 저장소 변수다. 켜고 끄기가 설정 한 줄이라 되돌리기 쉽지만, 반대로 저장소 파일만 봐서는 지금 켜져 있는지 알 수 없다.
- 위키 정합성 검사는 시드 안에서 끝나는 부분(--seed-only)만 deploy.yml 의 verify 에 있다. 운영 대조(유령 글·탭)는 배포로만 지워지는 상태라 배포 전 검사에 넣으면 배포 자체를 막는다. 그쪽은 사람이 배포 뒤에 돌린다.
- partner-simulator 는 PR 에서 검증되지 않는다. 깨진 채로 머지되면 배포 파이프라인의 verify 에서 처음 걸린다.
- 스모크는 공개 화면과 공개 API 만 친다. 로그인해야 보이는 관리자 화면은 스모크가 확인하지 않는다.
