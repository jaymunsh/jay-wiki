---
title: "miniPC k3s와 Cloudflare Tunnel 배포 구조"
slug: minipc-k3s-cloudflare
tab: "인프라"
parentId: infra
sortOrder: 1
kind: wiki
tags: minipc,k3s,cloudflare,deploy
source: scripts/seed-portfolio-wiki.mjs
---
- 포트포워딩 없는 miniPC에서 무엇을 외부 hostname으로 내보내고 무엇을 내보내지 않았나?
- 인증 없는 진입점은 Next.js web 하나로 묶고, Grafana는 Cloudflare Access 뒤에 두며, Spring은 별도 hostname 없이 /ws/chat WebSocket만 예외로 직접 연결하기로 판단했다.
- 2026-08-10에 노드의 /etc/cloudflared/config.yml을 직접 읽어 hostname 6개와 404 catch-all, 합쳐 ingress 규칙 7개를 확인했고 cloudflared tunnel ingress validate가 OK를 돌려줬다.

집에 있는 miniPC 한 대를 공인 IP도 포트포워딩도 없이 인터넷에 공개해야 했다. 그래서 배포 구조의 첫 번째 결정은
프레임워크가 아니라 **무엇을 외부 hostname으로 내보내고 무엇을 내보내지 않을 것인가**였다.

결론부터 쓰면 인증 경계는 두 개다. 익명으로 누구나 여는 쪽은 Next.js web(portfolio와 blog) 하나로 묶고,
Grafana·SSH·k3s API는 Cloudflare Access 뒤에 둔다. Spring은 별도 hostname을 갖지 않으며 일반 HTTP API는 web의 BFF를 거친다.
다만 실시간 채팅의 WebSocket 경로인 /ws/chat만 같은 portfolio hostname의 별도 Ingress로 Spring에 직접 연결한다.
PostgreSQL, Redis, OpenSearch, Kafka, MinIO는 k3s 내부 Service DNS로만 연결한다.

## 구조 — 요청은 web을 먼저 지나고 /ws/chat만 예외다

~~~mermaid
flowchart TB
    Browser[Browser] --> Tunnel[Cloudflare Tunnel]
    Tunnel --> Traefik[Traefik Ingress]
    Traefik --> Web[Next.js web + BFF]
    Traefik --> Grafana[Grafana - Access 보호]
    Traefik -->|/ws/chat| Spring
    Web --> Spring[Spring jaywiki]
    Web --> Assets[MinIO asset route]
    Web --> Prom[Prometheus aggregate]
    Spring --> Payment[FastAPI payment-api]
    Spring --> Shipping[FastAPI shipping-api]
    Spring --> Data[(PostgreSQL Redis OpenSearch Kafka)]
~~~

페이지와 일반 HTTP API 요청은 web을 먼저 지나고, 실시간 채팅 WebSocket만 Spring Ingress로 바로 간다.
web Deployment는 Spring, Prometheus, MinIO로 나가는 내부 주소를
API_INTERNAL_BASE, PROMETHEUS_INTERNAL_BASE, MINIO_ASSET_INTERNAL_BASE 환경 변수로 받는다.
세 값 모두 클러스터 내부 Service DNS이므로, 브라우저는 이 주소들을 알지 못하고 알 필요도 없다.

## 포트를 열지 않고 진입점을 하나로 모았다

| 선택지 | 판단 |
|---|---|
| 포트포워딩 | 공유기와 회선 제약 때문에 제외. 공인 IP를 그대로 노출하는 방식도 피하고 싶었다 |
| Cloudflare Tunnel | 아웃바운드 연결만으로 HTTPS 공개가 되고, 인바운드 포트를 열지 않는다 |
| Spring에 별도 hostname 공개 | 공개 API 주소와 인증 경계가 하나 더 늘어나 보류. WebSocket만 같은 hostname의 경로로 예외 처리 |
| Next.js만 인증 없이 공개 | 브라우저 진입점이 하나라 인증·BFF·오류 처리를 한 계층에 모을 수 있다 |

진입점을 하나로 줄인 대가도 있다. web이 죽으면 공개 화면 전체가 죽고, BFF 계층이 인증과 upstream 오류 변환까지
떠안아 얇지 않다. 이 트레이드오프는 단일 노드에서 운영 표면을 줄이는 쪽이 더 낫다고 판단해 받아들였다.

## raw 운영 데이터는 익명 방문자에게 주지 않는다

관측 화면까지 web BFF로 감싸는 길은 Grafana의 대시보드, 탐색기, 알림 화면을 전부 대신 구현하는 일이 된다.
그럴 이유가 없어서 Grafana는 자체 Ingress로 두고, 대신 인증 경계를 다르게 걸었다.

경계를 나눈 기준은 **raw 운영 데이터와 조작 권한을 익명 방문자에게 주지 않는다**는 것이다. 공개 사이트의
운영 패널은 Prometheus 집계 결과만 서버 측에서 읽어 내려보내고, PromQL·label·로그 원문·trace·클러스터
조작은 전부 Cloudflare Access 뒤에 남긴다.

같은 Tunnel 하나가 지금 hostname 6개를 받는다. 마지막의 http_status:404 catch-all까지 합치면
ingress 규칙은 7개다.

| 외부 hostname | 인증 | 공개 범위 |
|---|---|---|
| portfolio.leneu.cloud | 없음. 관리자 기능만 로그인·TOTP | 위키, 시연, Prometheus에서 뽑은 집계 지표 |
| blog.leneu.cloud | 없음 | 블로그. portfolio와 같은 web Deployment가 Host 헤더로 가른다 |
| spellcrown.leneu.cloud | 없음. 방은 초대 부호가 지킨다 | 보드게임. **이 클러스터 밖이다** |
| grafana.leneu.cloud | Cloudflare Access + Grafana 로그인 | raw metric, log, trace와 대시보드 전체 |
| ssh.leneu.cloud | Cloudflare Access | miniPC SSH |
| kube.leneu.cloud | Cloudflare Access | k3s API server |

클러스터로 가는 hostname은 전부 localhost:30220, 즉 Traefik의 NodePort로 넘긴다.
spellcrown만 Traefik을 지나지 않는다. k3s에 넣을 만큼 복잡하지 않은 단일 프로세스라
config.yml에서 곧장 localhost 포트로 보낸다. **Tunnel의 hostname이 곧 클러스터의 워크로드는 아니다.**

### 지운 항목 두 개

한때 api와 admin이라는 hostname도 이 목록에 있었다. 둘 다 http://localhost:80을 가리켰는데
이 호스트의 80번에는 아무도 없어서, api는 502를 그대로 돌려주고 admin은 Access가 먼저
가로막아 증상이 안 보일 뿐 뒤로 가면 똑같이 502였다.

ingress에서 줄 하나를 지우려면 cloudflared를 restart해야 하고 그게 공개 표면 전체를 잠깐 끊기 때문에,
죽은 채로 얼마간 남아 있다가 정리했다. 지금 config.yml에는 두 줄이 없다.

## 현재 상태는 일곱 항목으로 확인한다

- k3s node Ready
- frontend web pod Ready
- backend jaywiki pod Ready
- cloudflared active
- portfolio.leneu.cloud, blog.leneu.cloud HTTP 200
- grafana.leneu.cloud는 인증 없이 접근하면 Cloudflare Access 로그인으로 넘어간다
- Spring backend는 별도 외부 hostname이 없고, 같은 portfolio hostname의 /ws/chat만 직접 Ingress로 연결된다

## 크게 헤맨 두 번은 별도 글로 남겼다

이 구조를 만들면서 두 번 크게 헤맸고, 각각 별도의 글로 남겼다.

- 설정을 대시보드에서 고치려다 실패한 기록은 [Cloudflare Tunnel 설정 위치를 잘못 짚은 날](/wiki/cloudflare-tunnel-config-postmortem)에 있다.
- 손으로 만든 네임스페이스와 홈 디렉터리에만 있던 Helm values 때문에 이 클러스터를 다시 만들 수 없었던 문제는
  [k3s 매니페스트를 서비스 경계로 나눈 기준](/wiki/k3s-manifest-boundaries)에서 다룬다.

두 사건의 공통점은 구조를 잘못 그린 것이 아니라, 그 구조가 **어느 파일에 적혀 있는지**를 몰랐다는 것이다.
그림이 맞아도 설정의 위치를 모르면 고칠 수 없다.
