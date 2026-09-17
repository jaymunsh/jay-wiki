---
title: "miniPC 상태를 확인할 때 매번 쓰는 명령을 한 곳에 모은 기록"
slug: minipc-command-runbook
tab: "운영·관측"
parentId: operations
sortOrder: 7
kind: wiki
tags: minipc,kubectl,ssh,runbook,operations
source: scripts/seed-portfolio-wiki.mjs
---
- miniPC 배포·상태를 확인할 때 매번 찾아 쓰던 명령을 어디에 모아 뒀나?
- 로컬은 개발과 commit/push, miniPC는 상태 확인만 맡긴다는 경계를 명령 목록으로 그대로 남기기로 했다.
- ssh miniPC 'kubectl ...' 형태로 실제 실행한 상태·배포·러너·smoke 명령 원문을 그대로 옮겨 적었다.

## 결론 — 명령을 ssh miniPC 형태 원문으로 남긴다

miniPC 운영 명령은 ssh miniPC '<명령>' 형태로 남긴다. 로컬 노트북은 개발과 commit/push를 맡고,
miniPC는 k3s, cloudflared, self-hosted runner, 데이터 서비스 상태를 확인하는 역할을 맡는다.

## 왜 그렇게 했나

배포나 장애를 볼 때마다 같은 kubectl, systemctl, curl 조합을 새로 찾고 있었다. 매번 찾는 대신 한
번 확인한 명령을 그대로 남겨 두면, 다음번에는 복사해서 붙이기만 하면 된다.

재부팅처럼 한 번만 하는 절차는 이 글의 범위 밖이다. 그런 절차는
[miniPC 감시 재부팅 런북](/wiki/minipc-reboot-recovery-drill)과 그 2회차 문서가 따로 다룬다.
이 글은 평소에 반복해서 쓰는 상태 확인 명령만 모은다. cloudflared 설정을 반영할 때 tunnel 하위
명령을 빠뜨리면 안 된다는 함정처럼, 재부팅 절차와 겹치는 세부 사항은 여기서 다시 쓰지 않고
그 문서를 가리킨다.

## 실제 구성 — 상태·배포·러너·smoke 명령을 그대로 옮겼다

### 상태 확인

~~~bash
ssh miniPC 'kubectl get nodes'
ssh miniPC 'kubectl -n backend get pods -o wide'
ssh miniPC 'kubectl -n frontend get pods -o wide'
ssh miniPC 'kubectl -n data get pods -o wide'
ssh miniPC 'kubectl -n obs get pods -o wide'
~~~

### 배포 확인

~~~bash
ssh miniPC 'kubectl -n backend rollout status deployment/jaywiki --timeout=180s'
ssh miniPC 'kubectl -n frontend rollout status deployment/jaywiki-web --timeout=180s'
ssh miniPC 'kubectl -n backend get deploy jaywiki -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image --no-headers'
ssh miniPC 'kubectl -n frontend get deploy jaywiki-web -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image --no-headers'
~~~

### GitHub Actions runner

~~~bash
ssh miniPC 'systemctl is-active actions.runner.jaymunsh-jay-wiki.jaypc.service'
ssh miniPC 'journalctl -u actions.runner.jaymunsh-jay-wiki.jaypc.service --since "20 minutes ago" --no-pager -n 200'
~~~

runner 로그에서 "Running job: Deploy to miniPC k3s"와 "completed with result: Succeeded"가 보이면
self-hosted deploy 단계는 통과한 것이다.

### 공개 smoke

~~~bash
curl -fsS https://portfolio.leneu.cloud >/tmp/jaywiki-home.html
curl -fsS https://portfolio.leneu.cloud/scenarios >/tmp/jaywiki-scenarios.html
curl -fsS 'https://portfolio.leneu.cloud/api/bff/board/posts?page=0&size=1' >/tmp/jaywiki-board.json
~~~

### 장애를 볼 때 순서

~~~mermaid
flowchart TB
    A[portfolio.leneu.cloud 장애] --> B{HTTP 응답?}
    B -- no --> C[cloudflared / ingress / frontend 확인]
    B -- yes but API fail --> D[backend pod / logs 확인]
    D --> E[data namespace 확인]
    E --> F[Postgres Redis Kafka OpenSearch]
    A --> G[최근 배포 여부 확인]
    G --> H[GitHub Actions runner log]
~~~

cloudflared 자체의 상태 확인(systemctl is-active, tunnel ingress validate)과 반영 절차의 함정은
[터널을 고치려다 터널로 들어가는 문을 닫은 날](/wiki/cloudflared-reload-cut-the-ssh-path)에서 다룬다.
그 글은 SIGHUP이 reload가 아니라 종료로 처리되는 사고와 복구 경로를 다루고, 이 글은 평소에 쓰는
확인 명령에 집중한다.

## 한계 — miniPC가 SSH로 붙는 상태를 전제로 한다

이 명령들은 miniPC가 최소한 SSH로 붙는 상태를 전제로 한다. SSH 자체가 끊긴 상황의 복구 경로는
사설망 IP 우회를 포함해 재부팅 런북 쪽에 정리돼 있고, 이 글에는 없다. 명령 목록도 지금 구성
기준이라 네임스페이스나 서비스 이름이 바뀌면 같이 낡는다.
