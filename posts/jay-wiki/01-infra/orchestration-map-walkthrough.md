---
title: "오케스트레이션 지도를 한 칸씩 읽는 법"
slug: orchestration-map-walkthrough
tab: "인프라"
parentId: infra
sortOrder: 7
kind: wiki
tags: architecture,k3s,kubernetes,observability,cicd,overview
source: scripts/seed-portfolio-wiki.mjs
---
- 오케스트레이션 지도에 있는 스물세 개 칸이 각각 무엇이고, 이 프로젝트에서 무엇을 하며, 무엇을 일부러 안 쓰나?
- 지도 문구가 실물과 어긋난 곳(OTel Collector 파이프라인 구성, partner-simulator 노드 누락)은 지도 쪽을 고쳐 실물에 맞추기로 판단했다.
- OTel Collector 설정 파일을 열어 파이프라인이 traces 하나뿐임을 확인했고, 2026-08-09 재부팅 실측에서 91초 뒤 Pod 23개가 스스로 Ready 상태가 된 것을 확인했다.

첫 화면의 지도는 칸이 스물세 개다. 한 번에 보면 "여러 가지를 썼구나"로 끝나고, 그건 이 지도가 하려던 말이 아니다.
이 글은 그 스물세 칸을 **요청 하나가 지나가는 순서대로** 짚는다. 칸마다 문단 셋을 같은 순서로 쓴다.

| 문단 | 적는 것 |
|---|---|
| 첫째 | 이게 뭔가. 이 분야를 모르는 사람 기준으로, 실무에서 보통 어디에 쓰는지까지. 이 프로젝트와 무관한 일반 지식이다 |
| 둘째 | 여기서는 무엇을 하나. 수치·파일·이름으로 적는다. **추측이 아니라 저장소와 노드에서 읽은 값이다** |
| 셋째 | 여기서 안 쓰는 것. 일부러 뺀 것과 아직 없는 것이 그 칸의 경계다. 없으면 생략한다 |

기계는 한 대다. GenMachine 4700U, 8코어, 장착 메모리 16GB(8GB × 2 듀얼 채널), Ubuntu 24.04.4,
k3s v1.36.2다. 노드에서 읽으면 15GiB로 보이는데, 내장 GPU와 펌웨어가 부팅 때 제 몫을 먼저 떼기 때문이다.
이 한 대 위에 Pod 28개가 돌고 있고, 그것을 묶는 것이 지도 한가운데의 k3s다.
16GB를 그 28개가 어떻게 나눠 쓰는지는 아래 [메모리 배분](#16gb는-28개-컨테이너가-칸을-나눠-쓴다) 절에 칸별로 적었다.

## 먼저 전체 경로 하나

브라우저가 주소를 치고 화면이 뜰 때까지, 요청은 이 순서로 지나간다.

~~~mermaid
flowchart TB
  B["브라우저"] --> CF["Cloudflare 엣지"]
  CF -->|"암호화된 터널"| CFD["cloudflared (miniPC 안)"]
  CFD -->|"localhost:30220"| TR["Traefik (k3s ingress)"]
  TR --> WEB["Next.js web · frontend 네임스페이스"]
  WEB -->|"/api/bff/*"| API["Spring Boot · backend 네임스페이스"]
  API --> PG[("PostgreSQL")]
  API --> RD[("Redis")]
  API --> OS[("OpenSearch")]
  API --> KF[("Kafka")]
~~~

**이 그림에서 가장 중요한 것은 없는 선이다.** 공유기에 열어 둔 인바운드 포트가 하나도 없다.
집 IP로 들어오는 길이 없고, 연결은 전부 miniPC가 Cloudflare 쪽으로 **나가서** 만든다.

## PUBLIC EDGE — 바깥과 닿는 두 칸

### Browser

사용자가 직접 만지는 유일한 지점이고, 운영자가 통제할 수 없는 유일한 실행 환경이기도 하다.
그래서 실무에서는 보통 브라우저를 BFF나 API 게이트웨이 한 겹 뒤에 두고,
내부 서비스가 몇 개고 어디 있는지를 클라이언트에 노출하지 않는다.

여기서 브라우저가 아는 것은 공개 화면과 /api/bff/* 경로뿐이다. 백엔드 주소는 server-only 모듈에
갇혀 있어 브라우저 번들에 들어가지 않고, 브라우저로 나가는 값은 사이트 오리진·블로그 오리진·Grafana
오리진 셋뿐이다. 인증 토큰도 브라우저가 직접 들지 않는다 — HttpOnly 쿠키를 BFF가 릴레이한다.

예외는 딱 하나, 채팅이다. wss 프로토콜의 /ws/chat 연결은 Next.js를 지나지 않고 별도 Ingress를 타고
Traefik에서 Spring으로 바로 간다. "브라우저는 Next.js가 주는 화면과 /api/bff 경로만 안다"는 문장은
이 예외 하나를 빼면 참이다.

### Cloudflare Tunnel

서버 쪽에서 밖으로 나가는 연결을 먼저 만들어 두고, 외부 요청이 그 연결을 거꾸로 타고 들어오게 하는
방식이다. 실무에서는 공인 IP 없는 사설망 서비스를 노출하거나, 오리진 IP를 감추고 Zero Trust 접근
제어를 앞단에 둘 때 쓴다.

여기서는 miniPC 안의 cloudflared가 이 연결을 유지하고, 공개 트래픽 전부가 이 길로만 들어온다.
ingress 규칙은 7개다 — portfolio·blog·spellcrown 셋이 공개, grafana·ssh·kube는 Cloudflare Access 뒤,
마지막 규칙은 http_status:404이고, 대부분 localhost:30220의 Traefik으로 넘긴다.

저장소 쪽 매니페스트에는
바깥으로 직접 문을 여는 LoadBalancer·NodePort·hostPort 선언이 하나도 없고 Ingress는 두 host만 걸며,
매니페스트 주석이 "cloudflared ingress와 DNS가 있어야 밖에서 닿는다"고 적어 뒀다.

**여기에는 사고 기록이 하나 붙어 있다.** SSH도 이 터널을 타므로, 터널을 고치다 죽이면 고칠 통로까지
함께 사라진다. 실제로 SIGHUP을 reload로 착각해 그 일을 겪었고, 사설망 SSH로 복구했다.

안 쓰는 것도 있다. Cloudflare의 캐시·WAF 규칙은 저장소에서 관리하지 않고, 인바운드 포트 개방은
아예 안 쓴다. 그리고 터널 설정 자체가 miniPC 안에만 있어서, 이 칸은 저장소만으로는 검증되지 않는
유일한 진입 부품이다.

## k3s control plane — 지도 한가운데

k3s는 경량 Kubernetes 배포판이다. 하는 일을 한 문장으로 줄이면 "**원하는 상태를 적어 두면 실제
상태를 거기에 맞춰 놓는 것**"이고, 그 맞추는 동작이 지도에 적힌 reconcile loop다. 실무에서 k3s는
엣지·홈랩·CI처럼 컨트롤 플레인에 쓸 자원이 빠듯한 곳에 놓고, 대규모에서는 같은 API를 관리형
Kubernetes(EKS·GKE·AKS)로 쓴다 — 배포판이 달라도 언어는 같다.

여기서는 Deployment 4개, Helm으로 올린 데이터·관측 스택, Kafka StatefulSet, 백업 CronJob을 선언대로
유지한다. 예를 들어 "Pod 하나가 떠 있어야 한다"고 적어 두면, 사람이 지켜보지 않아도 이렇게 된다.

| 상황 | k3s가 하는 일 |
|---|---|
| Pod가 죽었다 | 다시 만든다 |
| 노드가 재부팅됐다 | 순서대로 다시 띄운다 |
| 이미지 태그가 바뀌었다 | 새 Pod를 띄우고 준비되면 옛 Pod를 내린다 |
| CPU가 오래 높다 | HPA 설정대로 복제본을 늘린다 |

2026-08-09 재부팅 실측이 이 문장의 증거다. 사람은 재부팅 명령 하나만 쳤고, 91초 뒤 Pod 23개가
스스로 Ready가 됐다(나머지 5개는 재기동이 필요 없었다).

네임스페이스는 넷으로 나눴다 —
frontend, backend, data, obs. 이름 공간을 나누면 같은 이름을 써도 안 부딪히고, 무엇보다
**어디까지가 한 덩어리인지가 이름에서 드러난다.** HPA는 CPU 80%에서 Spring을 1에서 2로 늘리는
것 하나뿐이고, 그 CPU 값은 Prometheus가 아니라 metrics-server가 잰다.
k3s에 딸려 오는 것들도 지도에는 안 보이지만 이 경로에 있다.

Traefik이 고른 Service 뒤에 파드가 둘 이상이면 요청은 거기서 갈린다. Service가 준비된 파드의
주소 목록을 들고 있고 kube-proxy가 그 목록으로 나눈다 — **따로 세운 로드밸런서가 없고,
이 분배 자체가 쿠버네티스의 로드밸런싱이다.** 노드가 하나라 LoadBalancer 타입 Service도 쓰지 않는다.
HPA가 Spring을 둘로 늘리는 동안 실제로 이 일이 일어난다.

| 구성요소 | 버전 | 역할 |
|---|---|---|
| Traefik | 3.7.4 | 들어온 요청을 어느 Service로 보낼지 정한다(ingress controller) |
| CoreDNS | 1.14.4 | 서비스 이름을 IP로 바꾼다 |
| local-path-provisioner | v0.0.36 | PVC 요청이 오면 노드 디스크에 폴더를 만들어 준다 |
| metrics-server | v0.8.1 | HPA가 볼 CPU 사용량을 모은다 |

**local-path에는 함정이 하나 있다.** PVC에 5Gi라고 적어도 그 크기에서 멈추지 않는다. 실제로는 노드
디스크를 그대로 쓰는 폴더라 쿼터가 없다. 그래서 이 시스템에서 용량 상한은 PVC 선언이 아니라 디스크 하나다.

안 쓰는 것을 세면 이 칸이 어디까지인지가 보인다. 멀티노드가 아니다 — 노드가 한 대라 HPA도 같은 기계
안에서만 는다. NetworkPolicy가 없고, ResourceQuota와 LimitRange도 없다. PodDisruptionBudget은
명시적으로 껐고, Ingress에 TLS 블록이 없다(TLS 종료는 Cloudflare 몫이다). 서비스 메시도 없고,
ArgoCD 같은 GitOps 컨트롤러 없이 배포 러너가 직접 kubectl apply를 친다.

## WORKLOADS — 내가 쓴 코드가 도는 칸

### Next.js web

React로 화면을 그리는 웹 프레임워크다. 화면을 서버에서 미리 그려 HTML로 보낼 수 있다.
실무에서는 SSR·SSG로 초기 렌더와 SEO를 챙기면서, 프론트 전용 서버가 인증과 비밀값을 쥐는
BFF 계층을 겸하는 자리에 자주 놓인다.

여기서도 그 두 역할을 겸한다. standalone 빌드를 node:22-alpine에 담아(Next ^15.0.3, React ^19.0.0)
컨테이너 3000 포트로 열고, replicas 1에 256Mi/512Mi, CPU 50m/500m이다. 라우트 핸들러는 여섯이다 —
bff, assets, hpa-rehearsal, operations, spreadsheet-export, wiki-assets. middleware가 Host 헤더를 보고
위키와 블로그를 가르므로 **Deployment 하나가 두 사이트를 서빙한다.**

BFF는 /api/bff/* 를 Spring의
/api/* 로 넘기면서 쿠키를 양방향으로 릴레이하고, 백엔드가 죽으면 날것의 오류 대신 problem+json
502를 만들어 돌려준다. cf-connecting-ip 헤더를 백엔드로 넘겨서 rate limit이 프록시 주소가 아니라
진짜 방문자 IP를 본다.

자체 세션 저장소는 없다 — 쿠키를 릴레이할 뿐 세션을 만들지 않는다. BFF가 넘기는 메서드는
GET·POST·PUT·DELETE 넷뿐이라 PATCH는 지나가지 못한다. HPA 대상이 아니고, Next.js의 이미지 최적화
서버 대신 MinIO 자산을 그대로 프록시한다.

### Spring Boot

자바로 서버를 만드는 프레임워크다. 설정보다 관례를 앞세워 웹 서버, DB 연결, 보안 같은 것을 기본값으로
들고 시작한다. 실무에서 트랜잭션·보안·데이터 접근이 얽힌 업무 도메인 서버의 기본값에 가깝고,
actuator 헬스체크가 컨테이너 오케스트레이터의 프로브와 잘 맞물린다.

여기서는 도메인 API 전부가 이 한 칸이다 — 위키와 revision, 인증(auth), 게시판(board), 블로그,
검색(search), Saga 오케스트레이션에 더해 채팅 WebSocket(chat), 관리자 scale과 HPA 리허설(ops),
계정(account), 파트너 API 리허설(domainlab), 카프카 데모(kafka) 패키지까지 있다.

Spring Boot 3.5.16에 Java 21(eclipse-temurin), 포트 8080, 512Mi/1Gi다. 테스트 246개(2026-08-19 기준)가 이 코드를 덮고
있고, 배포 워크플로가 그 테스트를 먼저 돌린 뒤에만 이미지를 만든다.

actuator는 health·info·prometheus·
metrics 넷만 열고, trace는 샘플링 1.0으로 OTel Collector 4318 포트에 직접 보낸다. 스키마는 Flyway가
만들고 JPA는 validate만 한다. **유일하게 HPA가 붙은 워크로드**고, CPU requests 100m이 그 스케일
판정의 분모다.

OSIV는 껐다. 로그를 파일로 남기지 않고 stdout으로만 찍는다 — 이유는 관측 절에서 이어 적는다.
서버 세션 대신 JWT 쿠키를 쓴다. 그리고 로컬 프로파일에서는 OpenSearch와 Kafka 데모가 기본으로
꺼져 있어서, 운영과 로컬의 동작이 같지 않다는 점은 그대로 남은 틈이다.

### FastAPI payment-api

FastAPI는 파이썬 웹 프레임워크로, 타입 힌트로 요청을 검증하고 async I/O를 기본으로 돈다.
실무에서는 이런 성질이 필요한 좁은 내부 서비스나 ML 추론 엔드포인트에 자주 쓴다.

여기서는 Saga의 결제 참여자다. 업무 엔드포인트가 넷이고(/health/live, /health/ready,
/payments/authorize, /payments/{id}/cancel) 여기에 /metrics가 자동으로 하나 더 붙는다.
uv와 python 3.12로 빌드하고, 96Mi/256Mi에 CPU 25m/300m이다.

OTel trace는 Collector로 보내고
메트릭은 Prometheus가 긁어 간다. **매 배포의 스모크 테스트가 이 서비스를 실제로 한 번 호출한다** —
failAt SHIPPING_REQUEST 주문을 넣어 보상 흐름까지 지나간다.

언어를 하나 더 쓴 이유는 취향이 아니라
경계 실험이다. Saga는 서로 다른 서비스가 각자 커밋하고 실패하면 보상하는 구조인데, 같은 프로세스
안에서 흉내 내면 진짜 경계가 아니다. 다른 언어, 다른 컨테이너, 다른 배포 단위로 떼어 놓아야
"저쪽이 응답을 안 한다"는 상황이 실제로 생긴다.

**자기 DB를 든다.** pg-services 인스턴스의 payment 데이터베이스에 결제와 아웃박스를 저장하고,
둘을 한 트랜잭션으로 쓴다. 여기가 결제의 원본이고 Spring은 이벤트로 전해 들은 사본만 본다.
멱등키는 유니크 제약이라 재시작해도 남는다 — 전에는 메모리에만 있어서, 재시작하면 그 전 주문의
보상 취소가 404였다. 인증은 없다(클러스터 내부 호출 전제). replicas 1에 HPA도 없다.

### FastAPI shipping-api

payment-api와 같은 FastAPI다. 여기서는 Saga의 배송 참여자다.

업무 엔드포인트가 셋이고(/health/live, /health/ready, /shipments/request) /metrics가 하나 더
붙는다. 결제와 달리 취소가 없다 — 배송은 이 사가의 마지막 단계라 뒤에 실패할 것이 없고,
배송이 실패하면 보상은 결제 취소와 재고 해제 쪽으로 간다. 160Mi/256Mi에 CPU 40m/300m이다.

**이 칸이 생기기 전에 배송은 코드였다.** 모놀리스가 tb_saga_shipping에 행 하나를 넣는 것이
전부였고, 그래서 "자를 로직이 없다"는 이유로 두 번째 분리 대상이 됐다. 옮기고 나서 바뀐 것은
로직이 아니라 소유권이다 — 배송의 원본이 pg-services의 shipping 데이터베이스로 갔고,
모놀리스는 이벤트로 전해 들은 사본만 본다. shipping_svc 계정은 payment 데이터베이스에
CONNECT가 없다. 결제와 배송이 서로도 못 읽는다는 뜻이다.

두 번째 사례라는 것이 이 칸의 값이다. 하나만 있으면 특수한 처리로 보이지만, 같은 모양이 둘이면
패턴이다 — 아웃박스를 같은 트랜잭션에 쓰고, 릴레이가 for update skip locked로 선점해 발행하고,
모놀리스가 projection에 반영하는 구조가 두 서비스에서 글자 그대로 같다.

### FastAPI partner-simulator

외부 협력사 API인 척하는 서비스다. 실무에서 이 역할은 WireMock이나 Mountebank 같은 계약 스텁,
서비스 가상화 도구가 맡는다 — 재시도·타임아웃·서킷브레이커 정책을 통합 테스트에서 말이 아니라
실제로 겪게 하는 용도다.

여기서는 실패 모드 다섯을 쿼리 파라미터로 고른다 — NORMAL, TIMEOUT_CALLBACK(2.5초 지연),
RATE_LIMIT(첫 시도에 429와 Retry-After를 주고 다음 시도는 성공), SERVER_ERROR(500), BAD_SIGNATURE.
**429를 받고 다시 가서 성공하는 것이 재시도 시나리오의 핵심이다.**

콜백은 1초 뒤 HMAC-SHA256 서명을
붙여 Spring으로 되쏘고(HTTP/2, timeout 2초, 재시도 1회), 응답마다 X-Partner-Simulator 헤더를 박아
실물과 구분한다. 서명 시크릿은 Spring과 같은 k8s Secret 하나를 나눠 쓴다. 64Mi/192Mi로 지도에서
가장 작은 칸이다.

**이 글을 쓰면서 지도에 추가한 칸이기도 하다.** 첫 화면이 사용자 요청 경로를
보이려는 그림이라 시나리오 전용 상대역을 빼 뒀는데, 클러스터에 떠 있는 것을 그림에서 빼면 그림이
실물과 갈린다. 지도를 고치는 쪽을 골랐다.

payment-api와 대비되는 점이 안 쓰는 목록에 있다. OTel 계측이 없고 /metrics도 없다. /health/live가
없어서 liveness 프로브도 ready를 같이 쓴다. 상태가 프로세스 메모리라 재시작하면 429 카운터가
리셋돼 시나리오가 처음부터 다시 시작된다.

## DATA & EVENTS — 상태를 나눠 담는 여섯 칸

한 데이터베이스에 다 넣지 않은 이유는 **수명과 접근 패턴이 다르기 때문이다.**

| 칸 | 버전 | 무엇을 담나 | 잃으면 |
|---|---|---|---|
| PostgreSQL portfolio | 18.4 | 위키 본문, revision, 계정, 게시판, 블로그, 조회수 원본 | 되돌릴 수 없다. 백업 대상 셋 중 하나다 |
| PostgreSQL pg-services | 18 | 결제와 배송의 원본과 아웃박스 | 되돌릴 수 없다. 백업 대상 셋 중 둘이 여기 있다 |
| Redis | 8.8.0 | 캐시, 중복 제거, 채팅 정원, 대기열 | 다시 만들면 된다 |
| Kafka | 4.0.0 | Outbox, fan-out, 재시도, DLQ 이벤트 | 진행 중이던 흐름이 끊긴다 |
| OpenSearch | 3.7.0 | 한국어 형태소 검색 인덱스 둘 | 검색이 LIKE 폴백으로 낮아질 뿐 죽지 않는다 |
| MinIO | 2024-12-18 | 스택 로고 SVG, 업로드 이미지, 벤치마크 증거 | 첫 화면 지도의 아이콘부터 사라진다 |

한 가지를 먼저 적어 둔다. **이 여섯 중 배포 파이프라인이 직접 올리는 것은 Kafka와 pg-services 둘이다.**
매니페스트가 저장소에 있어서다. portfolio PostgreSQL과 Redis,
OpenSearch, MinIO는 Helm 차트라 사람이 손으로 올린다. values를 고쳐 main에 머지해도 그것만으로는 아무 일도
일어나지 않는다.

### PostgreSQL portfolio

행과 열로 데이터를 담는 관계형 데이터베이스다. 여러 줄을 한 번에 바꾸다 중간에 실패하면 통째로 되돌린다(트랜잭션).
실무에서는 보통 주문·결제·회원처럼 트랜잭션 보장과 조인이 필요한 핵심 도메인의 1차 저장소로 쓴다.

결제와 배송을 뺀 모든 것의 Source of Truth다. 테이블 29개가 Flyway 마이그레이션 29개로 쌓여 있고, 테이블 이름을 훑으면
이 사이트가 하는 일이 그대로 보인다 — 위키 본문과 revision(글마다 조회수 view_count 포함), 계정, 게시판(tsvector
검색 포함), 블로그(포스트·태그·댓글에 일별·디바이스·리퍼러 통계까지 6테이블), Saga 7테이블, Kafka 데모
4테이블(outbox 포함), 도메인 시나리오 2테이블.

운영 인스턴스는 18.4이고 디스크 20Gi, requests 512Mi에
limits 1Gi다. 튜닝은 노드 한 대 몫에 맞췄다 — shared_buffers 256MB, effective_cache_size 768MB,
max_connections 80, work_mem 8MB, 그리고 500ms 넘는 쿼리는 로그에 남긴다.

매일 덤프와 sha256이 남고
8일치가 보관된다. 조회수는 Redis가 중복만 걸러 주고 숫자 원본은 이 테이블에 있어서, Redis가 통째로 비어도
조회수를 잃지 않는다.

배포 파이프라인 밖이다. bitnami 차트로 올렸고 values에 image 블록 자체가 없어 이미지 태그를 고정하지 않았다 —
이 이야기는 아래 GHCR 칸에서 잇는다.

### PostgreSQL pg-services

두 번째 인스턴스다. 안에는 payment와 shipping 두 데이터베이스가 있고, 각각의 원본과 아웃박스가
거기 있다. StatefulSet 하나에 PVC 5Gi, requests 50m/192Mi다.

**서비스마다 인스턴스를 따로 띄우지는 않았다.** 나눠서 얻는 것이 payment와 shipping 사이 한 칸인데,
그 둘은 서로 조인할 일이 없다. 그 한 칸 값으로 Pod 하나와 백업 대상 하나가 는다 —
이 설계가 리스크로 꼽은 자리가 백업이라 하나로 합쳤다.

**같은 노드, 같은 커널, 같은 디스크다.** 그러니 "다른 노드로 옮길 수 있다"는 흔한 이유는 여기서
성립하지 않는다. 인스턴스를 나눈 이유는 하나뿐이다 — NetworkPolicy의 podSelector가 파드 라벨을
보기 때문에, 같은 postgres에 스키마로만 나누면 네트워크 층에서 구분할 대상이 아예 없다.
그러면 소유권 강제가 계정 권한 한 겹으로 줄고, 보일 수 있는 증거가 "그렇게 안 썼습니다"뿐이 된다.

두 겹으로 막는다. 계정은 자기 데이터베이스에만 CONNECT를 갖고(PUBLIC의 기본 CONNECT는 빼 뒀다),
NetworkPolicy는 payment-api·shipping-api와 백업 CronJob 외의 파드를 거부한다.
모놀리스 파드에서 5432로 때려 보면 Connection refused가 난다 — kube-router가 타임아웃이 아니라
REJECT로 끊기 때문이다. 약속이 아니라 구조라는 증거가 그 한 줄이다.

### Redis

메모리 위에 사는 키-값 저장소다. 값마다 수명(TTL)을 줄 수 있어 잠깐만 기억하면 되는 것에 맞다.
실무에서는 흔히 세션 저장소, 캐시, 레이트 리밋, 분산 락, 경량 큐로 쓴다.

여기서 세면 용도가 여덟 가지이고, 전부 파생값이거나 단기 상태다.

| 용도 | 어떻게 |
|---|---|
| 게시판 rate limit | 키를 increment하고 창 크기만큼 expire |
| 게시판 조회수 카운터 | increment로 모았다가 DB에 반영 |
| 위키 조회수 중복 제거 | wiki:views:슬러그+IP 해시 키, TTL 24시간. 카운터 원본은 PostgreSQL tb_article.view_count |
| 관리자 TOTP 방어 | 쓴 코드 재사용 금지(TTL 90초)와 시도 횟수 제한(5분) |
| 블로그 방문자 중복 제거 | TTL 24시간 |
| 검색 결과 캐시 | TTL 60초 |
| HPA 리허설 분산 락 | 락 TTL 15분, 실행 기록 7일 |
| 채팅방 | Streams·Pub/Sub·ZSet 대기열·Set 정원·Hash 프로필, 이벤트는 200개로 trim |

원본이 하나도 없어서 설정으로 그렇게 못박았다 — maxmemory 200mb에 allkeys-lru(꽉 차면 안 쓴 키부터 버린다),
appendonly no로 디스크 영속화를 껐고, 인증도 없다(클러스터 안에서만 닿는다). 디스크 2Gi, requests 128Mi에
limits 256Mi다.

채팅방 정원은 Lua 스크립트로 지키는데, 이유가 코드에 적혀 있다 — HPA로 replica가 2가 되면
두 인스턴스가 동시에 정원을 넘길 수 있어서, 단일 스레드인 Redis에서 원자적 Lua 하나로 막는다. 지도의 HPA와
이 칸이 실제로 이어지는 지점이다.

백업 대상이 아니고, 역시 Helm이라 배포 파이프라인 밖이다.

### Kafka

메시지를 줄 세워 쌓아 두는 저장소다. 보낸 쪽과 받는 쪽이 같은 순간에 살아 있지 않아도 되고, 받는 쪽이 잠깐
죽어도 메시지는 줄에 남는다. 실무에서는 보통 서비스 간 비동기 결합 해제, 이벤트 소싱, 로그·클릭스트림 수집의
버퍼로 쓴다.

여기서 카프카를 쓰는 곳은 셋이다. 하나는 주문 이벤트 시연이고, 나머지 둘이 결제와 배송이다 —
**이 둘은 프로세스를 실제로 건넌다.** payment-api와 shipping-api가 각자 자기 DB에 아웃박스로 쌓으면
릴레이가 jaywiki.payment-events와 jaywiki.shipping-events로 내보내고, Spring이 그걸 받아 화면용
사본을 갱신한다.

이 경로가 생기기 전까지 카프카는 보내는 쪽과 받는 쪽이 같은 프로세스여서 서버를
건너지 않았다. 두 서비스의 릴레이 코드는 이름 말고 다른 데가 없다 — 같은 패턴을 두 번 놓은 것이다.

주문 이벤트 시연은 이렇게 돈다. 주문 저장과 이벤트 기록을 한 트랜잭션에 담고(Outbox),
릴레이가 2초마다 NEW 행을 CLAIMED로 선점해 발행한 뒤 PUBLISHED로 바꾼다 — 실패하면 NEW로 되돌리므로
릴레이가 발행 도중 죽어도 주문이 멈추지 않는다.

토픽 jaywiki.order-events(파티션 3, 복제 1)를 컨슈머 그룹 셋
— inventory, notification, analytics — 이 각자 읽고, 그룹이 다르므로 같은 메시지를 셋이 각각 받는다.
소비가 실패하면 500ms 간격으로 두 번 더 시도한 뒤 jaywiki.order-events.dlq로 넘어가는데, **그 DLQ를 읽는
네 번째 그룹이 따로 있다** — 화면에 보이게 하기 위해서다.

지금 값은 apache/kafka 4.0.0, KRaft 단일 노드,
저장소 5Gi, heap 256~512m, requests 512Mi에 limits 1Gi다. 지표는 jaywiki.kafka. 접두사 4종이 있고
DLQ로 한 건이라도 빠지면 알림 규칙이 잡는다. 운영은 켜져 있고 로컬 기본값은 꺼짐이다.

위키·블로그·게시판·검색은 카프카를 전혀 지나지 않는다. 사람이 화면에서 주문을 만들지 않으면 토픽은 비어 있다.
파티션 3도 선언만 있다 — 그룹당 컨슈머가 하나라 병렬성은 실제로 안 쓴다.

### OpenSearch

검색엔진이다. 글을 미리 단어로 쪼개 어느 단어가 어느 글에 있는지를 뒤집어 적어 두고(역색인), 찾을 때는 그 표만
본다. 실무에서는 흔히 전문 검색, 로그 분석, 자동완성·추천, 대시보드의 백엔드로 쓴다.

여기서는 한국어 형태소 검색을 맡고, 인덱스가 둘이다 — 위키(jaywiki-articles-v1, title·summary·body·tags)와
게시판(jaywiki-posts-v1, title·content), 둘 다 nori_tokenizer에 lowercase와 nori_part_of_speech를 얹은
korean_nori 분석기를 쓴다. 위키는 글 저장·삭제 시 이벤트로 증분 색인하고 관리자 API로 전량 재색인도 된다.

**이 칸의 존재 이유는 게시판의 검색 3종 비교다** — 같은 질의를 LIKE, PostgreSQL tsvector, OpenSearch+nori
셋으로 돌려 시간과 히트 수를 나란히 보여 준다.

nori 플러그인 때문에 3.7.0 자체 이미지를 굽고 커밋 SHA 태그를
붙인다. 구성은 single-node에 보안 플러그인 off, heap 512m 고정, PVC 15Gi, requests 1Gi에 limits 1.5Gi다.

꺼져도 검색이 죽지 않는다. 엔진이 없으면 PostgreSQL LIKE로 낮춰 폴백하고 응답에 어느 엔진을 썼는지 실어
보낸다. 관리자가 scale 0으로 내려 1Gi를 통째로 회수할 수 있는 근거가 이 폴백이다.

### MinIO

S3와 같은 방식으로 말하는 오브젝트 저장소다. 실무에서는 보통 사용자 업로드 파일, 이미지·동영상 원본, 빌드
산출물, 데이터 레이크 원본, 그리고 DB 백업의 오프사이트 사본을 담는다 — 다만 이 프로젝트에서 백업은 여기로
오지 않는다.

여기서 실제로 쓰이는 버킷은 wiki-assets 하나이고, 그 안에 용도가 셋 있다. 관리자 화면에서 올리는 위키·블로그
이미지, **첫 화면 오케스트레이션 지도의 스택 로고 SVG 17개** — 지금 이 글이 해설하는 바로 그 그림의
아이콘이라, MinIO가 죽으면 지도의 아이콘부터 사라진다 — 그리고 벤치마크 증거
발행물(publications/local-llm/2026-07-21-m1-max 네 파일, SHA256SUMS 검증 후 업로드)이다. 로고와 발행물은
배포마다 Job이 다시 올린다.

웹은 MinIO를 직접 노출하지 않는다 — same-origin /api/assets/** 라우트가 허용
목록(SVG 17개 + 발행물)을 대조한 뒤 프록시하고, 목록에 없는 경로는 404다. 캐시 정책도 둘로 갈린다 — 로고는
1시간 + stale-while-revalidate, 발행물은 1년 immutable.

지금 값은 단일 노드, 디스크 50Gi, requests 256Mi에
limits 512Mi다.

버킷은 셋이 선언돼 있지만 backups와 batch-output을 읽거나 쓰는 코드·스크립트·워크플로가 저장소에 하나도
없다 — 빈 껍데기다. DB 백업은 여기가 아니라 data 네임스페이스의 PVC jaywiki-pg-backups(5Gi)로 가고,
50Gi를 쓰는 것은 사실상 wiki-assets 하나다.

## OBSERVABILITY — 무슨 일이 있었는지 아는 다섯 칸

신호는 세 종류다. 지표는 숫자, 로그는 문장, trace는 요청 하나가 지나간 경로다.

~~~mermaid
flowchart TB
  SP["Spring · payment-api · shipping-api"]
  SP -->|"OTLP trace"| OT["OTel Collector 0.155"]
  OT --> TP["Tempo 2.9"]
  ALL["모든 워크로드"] -->|"stdout"| FILE["노드 로그 파일"]
  FILE --> PT["promtail"]
  PT --> LK["Loki 3.6.7"]
  SP -->|"/metrics 를 긁힘"| PR["Prometheus 3.12"]
  TP -->|"span metrics remote-write"| PR
  TP --> GF["Grafana 12.3.1"]
  LK --> GF
  PR --> GF
~~~

**이 그림에서 trace와 지표를 내는 것은 Spring과 두 Saga 참여자뿐이다.** partner-simulator는 OTel 의존성도
환경변수도 없고, Next.js도 계측이 없다. Prometheus가 긁는 대상도 backend와 payment-api·shipping-api 셋이다.

첫 화면의
지도는 원래 이 부분을 workloads 전체가 OTel Collector를 지나는 한 줄로 줄여 놓았는데, 설정을 열어 보면
Collector의 파이프라인은 traces 하나뿐이다 — 지표는 Prometheus가 직접 긁고 로그는 promtail이 나른다.
이 글을 쓰다 찾았고 지도 쪽 문구를 고쳤다.

하나 더 있다. **이 다섯 칸은 전부 배포 파이프라인 밖이다.** deploy.yml의 kubectl apply 목록에
infra/k8s/observability 아래가 한 줄도 없다. 알림 규칙이나 대시보드를 고쳐 main에 머지해도 운영에는
반영되지 않는다 — 사람이 Helm으로 올려야 한다.

### OTel Collector

앱과 관측 백엔드 사이의 중립 지대다. 앱은 표준 형식(OTLP)으로 쏘기만 하고, 백엔드를 바꿔도 앱을 안 고치게
하며, 샘플링·마스킹·재시도를 한 곳에 모은다 — 실무에서 이 칸을 따로 두는 보통의 이유다.

여기서는 Spring과 payment-api·shipping-api의 OTLP trace를 grpc 4317, http 4318 두 포트로 받아 batch와 memory_limiter를
거쳐 Tempo 4318로 넘긴다. kubernetesAttributes preset이 Pod 이름과 네임스페이스를 붙여 주므로, trace를 볼 때
어느 Pod가 낸 것인지 따로 찾지 않아도 된다. 파이프라인은 traces 하나뿐이라 지표와 로그는 이 경로를 지나지
않는다. requests 96Mi에 limits 256Mi다.

metrics·logs 파이프라인은 없고, debug exporter는 선언만 된 채 어느 파이프라인에도 안 붙어 있다.
partner-simulator와 Next.js는 이 창구를 안 쓴다.

### Prometheus

pull 기반 시계열 데이터베이스의 사실상 표준이다. 앱이 보내 주기를 기다리지 않고 각 서비스의 지표 엔드포인트를
주기적으로 긁어 쌓는다. 장기 보존은 보통 Thanos나 Mimir 같은 원격 저장소를 붙여 푼다.

여기서는 backend의 /actuator/prometheus와 payment-api·shipping-api의 /metrics를 15초마다 긁는다. 보존 7일, PVC 8Gi,
requests 384Mi에 limits 768Mi다.

**알림 규칙이 열넷이다** — 백엔드 다운, p95 지연, 5xx 비율, 5xx 관측, 400 관측,
관리자 403 지속, Pod 재시작, Kafka DLQ, 결제 취소 실패, 고아 사가, 노드 메모리, 디스크,
백업 실패, 백업 미실행.

하나하나의 조건과 실제 도착 모양은 [알림 목록](/wiki/alerting-inventory-and-gaps)에 있다. 400을 따로 보는 규칙이 있다는 것이 이 프로젝트의
알림 설계와 맞는다 — 조용히 실패하는 요청도 잡겠다는 뜻이다. Tempo가 만든 span metrics도 remote-write로
받는다.

pushgateway는 껐다. 원격 장기 저장소가 없어 7일 넘는 추세는 못 본다.

### Loki

로그 저장소다. 로그 본문을 인덱싱하지 않고 라벨만 인덱싱해서 싸다 — 대신 라벨 카디널리티를 잘못 잡으면
그 이점이 통째로 사라진다는 것이 흔히 지적되는 함정이다.

여기서는 SingleBinary 모드, 복제 1, filesystem 저장, PVC 5Gi, requests 192Mi에 limits 512Mi로 돈다.
앱은 stdout으로 찍기만 하고 promtail이 노드 로그 파일을 모아 밀어 넣는다. 알림 규칙(ruler)이 2026-08-12에
생겼다 — Spring의 예외 로그 한 줄을 정규식으로 잡아 trace_id와 Pod 이름을 뽑아 텔레그램으로 보낸다.

**보존 정책이 없다. 디스크가 찰 때까지 쌓인다.** gateway·canary·캐시는 전부 껐고 read/write/backend는
0 replica다. 그리고 Helm values라 파이프라인 밖이다 — ruler 규칙을 고쳐도 배포로는 안 나간다.

### Tempo

분산 추적 저장소다. 느리다는 신고를 서비스 경계 단위로 쪼개, 어느 홉에서 시간이 갔는지 보여 주는 것이
실무에서의 쓰임이다.

여기서는 OTel Collector가 넘긴 trace를 받아 24시간 보관한다. PVC 4Gi, requests 192Mi에 limits 512Mi다.
**metricsGenerator가 service-graph와 span metrics를 만들어 15초마다 Prometheus로 remote-write한다** —
지도에 없는 역방향 화살표다. Grafana의 Loki 데이터소스는 로그에서 trace_id를 뽑아 Tempo로 점프시킨다.

보존이 24시간이라 어제 장애는 못 판다. 사후 조사에는 못 쓴다는 뜻이다. 역시 Helm values라 파이프라인 밖이다.

### Grafana

관측의 프론트엔드다. 저장은 안 하고 여러 소스를 겹쳐 본다. 대시보드를 클릭으로 만들지 않고 코드로 관리하는
것이 실무에서 권장되는 형태다.

여기서는 데이터소스 셋(Prometheus 기본, Loki, Tempo)을 프로비저닝하고, **대시보드 둘을 JSON으로 코드에 박아
둔다** — 요청량·오류·p95·Up·노드 메모리·Pod 수 6패널의 Jaywiki RED와 Jaywiki Kafka Demo다. PVC 2Gi,
requests 128Mi에 limits 320Mi. 인증이 이중이다 — Cloudflare Access를 지난 뒤 Grafana 자체 로그인이 한 번
더 있다.

알림 주체가 아니다. 알림은 Prometheus 규칙과 Loki ruler와 Alertmanager가 처리한다. 그리고 대시보드가 코드에
있어도 파이프라인 밖이라, 고치면 사람이 올려야 반영된다.

## DELIVERY & RECOVERY — 코드가 서버에 닿는 다섯 칸

~~~mermaid
flowchart TB
  P["main 브랜치에 push"] --> V["verify: Spring 198 · web 110 · ruff · pytest"]
  V --> BD["build: 이미지 5개를 커밋 SHA 태그로"]
  BD --> GH["GHCR"]
  GH --> RN["miniPC self-hosted runner"]
  RN --> CAP["현재 이미지 목록을 파일로 갈무리"]
  CAP --> MF["매니페스트 적용과 MinIO 자산 업로드"]
  MF --> RO["kubectl 이미지 교체와 rollout"]
  RO --> BK["콘텐츠 동기화 전에 PostgreSQL 백업"]
  BK --> SY["검토된 위키 콘텐츠 동기화"]
  SY --> SM["공개 smoke test 7개"]
  SM -->|"실패하면"| RB["갈무리한 목록으로 롤백"]
~~~

### GitHub Actions

저장소 이벤트에 붙는 CI/CD다. 검증과 배포를 같은 파일에 두면 테스트를 통과한 것만 나간다는 규칙이 문서가
아니라 구조로 강제된다 — 실무에서 이 배치를 고르는 이유다.

여기서는 main push에 경로 필터를 걸어 verify → build → deploy 3잡이 돈다. verify가 Spring 테스트 238개,
웹의 린트·타입 검사·테스트 118개·빌드, 파이썬 세 서비스의 ruff·basedpyright·pytest를 돌리고, **테스트가
깨지면 이미지를 아예 만들지 않는다.** concurrency 그룹이 하나라 배포가 겹쳐 돌지 않는다. PR에는 별도
ci.yml 4잡이 돈다.

**PR용 ci.yml에는 partner-simulator 잡이 없다** — 이 서비스는 main에 들어간 뒤에야 처음 검사된다.
그리고 경로 필터에 docs와 posts가 없어, 글만 고친 커밋은 배포가 안 돈다.

### GHCR

GitHub Container Registry, 이미지 보관소다. 레지스트리는 배포의 기억이다 — 불변 태그가 없으면 롤백은
"그때 그 이미지"가 아니라 "그 태그가 지금 가리키는 것"이 된다.

여기서는 이미지 여섯(backend, web, payment-api, shipping-api, partner-simulator, opensearch-nori)을 커밋 SHA 태그로
올리고, :main 이동 태그도 같이 올린다. **배포에 쓰는 것은 SHA 태그다.** OpenSearch만 3.7.0-커밋SHA 형태다.
k3s는 별도 pull secret으로 당긴다 — push 토큰과 pull 토큰이 다르다.

이미지 정리(GC)는 넣지 않기로 정했다. 그리고 내가 만든 이미지에 지킨 태그 고정 규칙을 빌려 쓰는 이미지에는
안 지켰다 — bitnami 차트들은 태그를 고정하지 않아 차트 기본값을 따르고, 어떤 이미지가 오는지는 재설치
시점에 따라 달라진다. 남은 구멍이다.

### self-hosted runner

사설망 안 클러스터에 배포할 때의 표준 회피책이다. 대가는 러너 머신 자체가 신뢰 경계가 된다는 것 —
저장소에 write할 수 있는 사람은 그 기계 위에서 코드를 돌릴 수 있다.

여기서는 self-hosted·linux·x64·minipc 라벨이 붙은 deploy 잡만 miniPC 안에서 돈다. environment는
production, 타임아웃 25분이다. 클러스터 API가 밖에 열려 있지 않으니, kubeconfig를 GitHub에 맡기는 대신
러너를 안에 뒀다 — 자격증명이 기계 밖으로 안 나간다. 배포 잡이 하는 일에는 순서가 있다.

| 순서 | 무엇 | 왜 |
|---|---|---|
| 1 | 네임스페이스와 시크릿 적용 | 선언을 먼저 맞춘다 |
| 2 | 현재 이미지 목록 갈무리 | 실패했을 때 돌아갈 곳 |
| 3 | 매니페스트 적용과 MinIO 자산 업로드 | 정적 자산을 새 이미지보다 먼저 맞춘다 |
| 4 | 이미지 교체와 rollout | |
| 5 | 콘텐츠 동기화 전에 PostgreSQL 백업 | 위키 시드가 DB를 건드리기 전에 |
| 6 | 검토된 위키 콘텐츠 동기화 | 시드가 운영 DB에 upsert된다 |
| 7 | 공개 smoke test 7개 | 홈, 채팅 화면과 채팅 API, 게시판, Saga 주문, Kafka, 파트너 시나리오 |
| 8 | 어느 단계든 실패하면 롤백 | 갈무리해 둔 목록으로 되돌린다 |

smoke test는 클러스터 안이 아니라 공개 주소를 친다. 클러스터 안에서 확인하면 터널과 Traefik을 건너뛰므로
사용자가 겪는 경로를 확인한 것이 아니다.

러너가 한 대라 그 기계가 죽으면 배포 경로도 함께 죽는다. OpenSearch는 Helm atomic upgrade 경로인데 운영
리허설 전이다. 그리고 8번의 롤백도 마찬가지다 — **설계는 있지만 운영에서 실제로 되돌려 본 기록이 없다.**
검증된 기능이 아니라 아직 리허설 전의 설계다.

### backup CronJob

dump에 체크섬을 붙이고 오래된 것을 지우는 조합은 백업의 최소 구성이다. 실무에서 그다음 단계는 오프사이트
복제와 정기 복원 드릴이다 — 복원해 보지 않은 백업은 백업이 아니라는 말이 그 이유다.

여기서는 매일 03:17에 postgres:18-alpine 컨테이너가 떠서(DB 이미지가 아니라 이 백업 잡의 컨테이너다)
pg_dump --format=custom으로 덤프를 뜨고, .sha256을 함께 남긴다 — 파일이 있다는 것과 온전하다는 것은 다르기
때문이다. 오래된 파일은 find -mtime +7로 지우는데, 이 조건은 8일차부터 걸리므로 실제 보존은 8일치다.
백업은 data 네임스페이스의 PVC jaywiki-pg-backups(5Gi)에 쌓이고, 잡은 requests 128Mi에 limits 512Mi다.

**배포 잡도 콘텐츠 동기화 직전에 같은 CronJob으로 Job을 하나 더 만든다** — 위키 글을 덮어쓰기 직전 상태가
항상 백업으로 남는다.

복원 리허설은 이 CronJob이 하지 않는다. 스크립트는 있다 — sha256 검증, 임시 DB 복원, row count 대조,
임시 DB 삭제까지 한다 — 하지만 사람이 불러야 돈다. timeZone을 지정하지 않아 03:17이 어느 시간대인지는
노드 설정에 달렸고, 외부 복제가 없어 디스크가 통째로 죽으면 백업도 함께 죽는다.

### Cloudflare R2

S3 호환 오브젝트 저장소다. egress 요금이 없어 백업의 오프사이트 복제와 정적 자산 배포에 자주 쓴다.
재해 복구에서 중요한 것은 다른 디스크가 아니라 **다른 장애 도메인**이라는 점이 이 칸의 배경이다.

여기서는 아직 없다. 지도에서 유일하게 예정 상태로 표시된 칸이다. 계획은 정해져 있다 — 보관 30일, rclone
CronJob, 전용 시크릿, 7단계 절차 — 그리고 그중 하나도 실행하지 않았다. 그때까지 위 백업은 원본과 같은
디스크에 있고, 이 시스템은 프로세스 장애는 견디지만 하드웨어 장애는 못 견딘다.

## 16GB는 28개 컨테이너가 칸을 나눠 쓴다

한 대뿐이라 메모리가 가장 먼저 포화될 자원이고, 그래서 모든 칸에 requests와 limits가 붙어 있다.
requests는 스케줄러에게 하는 약속("이만큼은 보장해라")이고, limits는 상한("이 이상 쓰면 죽인다")이다.
아래 값은 infra/k8s 매니페스트에서 그대로 읽은 것이다.

| 칸 | requests | limits | 붙여 둔 근거 |
|---|---:|---:|---|
| Spring Boot | 512Mi | 1Gi | JVM. HPA로 2개가 되면 requests도 두 배가 된다 |
| Next.js web | 256Mi | 512Mi | 화면 렌더와 BFF 프록시 |
| FastAPI payment-api | 96Mi | 256Mi | Saga 참여자. 작게 시작해 부족하면 올린다 |
| FastAPI shipping-api | 160Mi | 256Mi | 두 번째 Saga 참여자 |
| FastAPI partner-simulator | 64Mi | 192Mi | 시나리오 상대역. 가장 작다 |
| PostgreSQL | 512Mi | 1Gi | 원본 저장소. shared buffers와 연결 수가 여기서 나온다 |
| PostgreSQL pg-services | 192Mi | 512Mi | 결제·배송의 원본. 두 번째 인스턴스다 |
| Redis | 128Mi | 256Mi | maxmemory 200mb, allkeys-lru — 꽉 차면 안 쓴 키부터 버린다 |
| Kafka | 512Mi | 1Gi | heap 256m~512m. 나머지는 페이지 캐시 몫 |
| OpenSearch | 1Gi | 1.5Gi | heap 512m 고정 = requests의 절반. 가장 큰 칸이다 |
| MinIO | 256Mi | 512Mi | 오브젝트 저장소 |
| Prometheus | 384Mi | 768Mi | 보존 7일이 이 크기를 정한다 |
| Grafana | 128Mi | 320Mi | 화면만 그린다 |
| Loki | 192Mi | 512Mi | 로그 저장 |
| Tempo | 192Mi | 512Mi | trace 저장 |
| OTel Collector | 96Mi | 256Mi | 파이프라인에 memory_limiter가 한 겹 더 있다 |
| promtail | 48Mi | 128Mi | 로그 수집 |
| alertmanager · kube-state-metrics · node-exporter | 112Mi | 320Mi | 관측 보조 셋의 합 |
| 백업 CronJob | 128Mi | 512Mi | 매일 실행되는 동안만 잡는다 |

**합이 이 표의 요점이다.** 2026-08-19에 클러스터에 물어 다시 세면 Pod 하나씩 기준으로 requests 합이
4,864Mi(약 4.75Gi), limits 합이 9,920Mi(약 9.69Gi)다. 하루 몇 분만 뜨는 백업 CronJob 행까지
더하면 약 4.87Gi/10.19Gi가 된다.

같은 날부터 **Spring 은 상시 둘**이라(HPA minReplicas 2) 실제 상시 합은 여기에 512Mi/1Gi 를
더한 약 5.27Gi/10.69Gi 다. 그 상태의 노드 실사용을 재면 47%(7,229Mi)이고, 둘째 파드가
실제로 먹는 것은 463Mi 였다.

- 예전 수치 ~~requests 약 4.6Gi, limits 약 9.2Gi~~
  - 2026-08-19 정정: **표에 pg-services 행이 빠져 있었고, 합도 그만큼 덜 세고 있었다.**
    본문에는 그 인스턴스의 절이 따로 있는데 자원 표에만 없었다. 192Mi/512Mi를 더하면 옛 수치와
    맞아떨어진다 — 계산이 틀린 게 아니라 세는 목록이 한 줄 짧았다.

노드가 15GiB이므로
모든 Pod가 동시에 limits 끝까지 가도 노드 메모리 안에 들어온다 — **과약정(overcommit)을 안 했다.**
남는 5GiB 남짓이 OS, k3s 자신, 그리고 PostgreSQL·Kafka가 기대는 파일시스템 캐시의 몫이다.

실사용은 2026-08-19 기준 노드의 44%(6,777Mi)다. 문서를 처음 쓸 때는 34%(약 5.3GB)였는데,
그 사이 결제·배송 두 서비스와 pg-services 인스턴스가 늘었다. 이 값은 첫 화면 TRAFFIC 카드의
RAM 과 같은 출처이므로, 지금 몇 %인지는 문서가 아니라 화면에서 본다.

CPU에도 같은 방식으로 requests와 limits가 붙어 있다. 내가 쓴 코드가 도는 다섯 칸만 적으면
Spring 100m/1, web 50m/500m, payment-api 25m/300m, shipping-api 40m/300m,
partner-simulator 20m/200m이다.

이 중 Spring의 requests 100m이 따로 중요한데, HPA의 "CPU 80%"는 limits가 아니라 **requests가
분모**라서, Spring이 평균 80m 넘게 쓰는 순간부터 복제본이 늘어난다. 상한이 아니라 약속을 기준으로
늘리는 것이 Kubernetes HPA의 방식이다.

칸마다 값이 다른 이유도 표에 적었지만, 하나만 더 짚는다. OpenSearch가 가장 큰 칸(1Gi)인 것은
heap 512m에 Lucene이 쓰는 힙 밖 메모리와 파일시스템 캐시 공간을 더한 값이기 때문이고, PVC도 15Gi로
데이터 칸 중 큰 축이다. 그래서 검색 실험이 필요 없을 때 관리자 scale 0으로 내려 1Gi를 통째로
돌려받을 수 있게 해 뒀다.

경계가 뚫리면 어떻게 되는지도 정해져 있다 — limits를 넘긴 Pod는
OOMKill로 그 Pod만 죽고, 노드 전체가 밀리면 k3s가 memory.available 300Mi 선에서 Pod를 축출해
노드를 지킨다.

## 이 지도가 감추는 것부터 먼저 적는다

이 지도를 처음 보는 사람이 가장 먼저 짚을 곳이다. 물어보기 전에 먼저 적는 편이 낫다.

| 감춰지는 것 | 사실 |
|---|---|
| 고가용성처럼 보인다 | 노드가 하나다. 노드가 죽으면 전부 멈춘다. HPA도 같은 기계 안에서만 는다(1~2) |
| Kafka가 견고해 보인다 | 복제본 1이다. 내구성이 아니라 비동기 경계를 위해 쓴다 |
| 저장소가 격리돼 보인다 | PVC에 적은 용량은 상한이 아니다. local-path라 전부 같은 디스크를 나눠 쓴다 |
| 관측이 완전해 보인다 | 지표 보존은 7일이다. 한 달짜리 추세는 아직 못 본다 |
| 전부 배포 파이프라인이 나르는 것처럼 보인다 | deploy.yml의 kubectl apply 목록에 관측 스택이 한 줄도 없고, PostgreSQL·Redis·MinIO·OpenSearch는 Helm이라 사람이 올린다. 파이프라인 안의 데이터 칸은 Kafka뿐이다 |
| 롤백이 검증된 기능처럼 보인다 | 스크립트는 있지만 운영에서 실제로 되돌려 본 기록이 없다. 리허설 전까지는 설계지 검증이 아니다 |
| 모든 요청이 Next.js를 지나는 것처럼 보인다 | 채팅 WebSocket은 별도 Ingress로 Traefik에서 Spring으로 바로 간다. 지도의 화살표는 이 경로를 안 그린다 |
| 백업이 안전해 보인다 | 같은 디스크에 있다. 외부 복제는 아직 next다 |

파이프라인 행은 결과가 하나로 이어진다 — **알림 규칙이나 대시보드를 고쳐 main에 머지해도 운영에
반영되지 않는다.** 관측 설정은 사람이 Helm으로 다시 올려야 바뀐다. 저장소에 있다는 것과 배포가
나른다는 것은 다른 말인데, 지도는 그 구분을 그리지 않는다.

## 핵심 질문 넷에 미리 답한다

"**한 대인데 왜 Kubernetes인가.**"
컨테이너 몇 개를 띄우는 것만이면 docker compose로 충분하다. k3s를 쓴 이유는 선언과 조정이다.
재부팅 뒤 91초 만에 손 하나 안 대고 Pod 23개가 제자리로 돌아온 것, 배포가 rollout과 롤백을 같은 방식으로
표현할 수 있는 것이 그 값이다. **한 대에서 배우고, 여러 대에서 쓰는 것이 같은 언어라는 점도 포함이다.**

"**왜 언어를 셋이나 쓰나.**"
경계를 만들기 위해서다. Saga의 참여자가 같은 프로세스 안에 있으면 실패를 흉내 낼 수만 있고 겪을 수는 없다.
다만 대가도 있다 — CI에서 검사할 도구가 셋이 되고 배포 이미지가 다섯이 된다. 그 비용은 워크플로에 그대로 보인다.

"**관측을 왜 이렇게까지.**"
장애를 두 번 겪고 나서 넣었다. 하나는 터널을 죽인 사고였고, 하나는 캐시를 원인으로 잘못 짚은 일이었다.
**둘 다 현상은 맞게 봤는데 원인 확인 없이 그럴듯한 설명을 붙였던 경우다.** trace와 로그를 같은 id로 잇는 것은
그 습관을 막는 장치다.

"**운영을 얼마나 자동에 맡겼나.**"
재부팅은 조건부 자동이고, 배포는 verify부터 smoke test까지 완전 자동이다. 실패하면 갈무리해 둔
이미지 목록으로 되돌리는 단계까지 스크립트에 있지만, 그 롤백이 운영에서 실제로 발동한 적은 아직
없다 — 자동으로 만든 것과 검증한 것은 다르고, 이 롤백은 아직 전자다. 반대로 자동에 안 맡긴 것도 있다 —
운영 콘텐츠 발행은 사람이 TOTP를 넣어야 하고, 정기 재부팅과 이미지 정리는 넣지 않기로 정했다.
**정한 것과 빠뜨린 것을 구분해 적는 것이 이 위키의 규칙이다.**

## 숫자가 의심스러우면 클러스터에 묻는다

여기 적은 버전과 개수는 2026-08-10에 노드에서 읽은 값이다. 이미지 태그는 배포마다 바뀌고, 보존 설정과
PVC 크기는 언제든 바뀔 수 있다. **숫자가 의심스러우면 이 글이 아니라 클러스터에 물어보는 것이 맞다.**
글에 적은 조회 방법을 그대로 쓰면 된다.

이 글은 지도를 아래로 파고드는 쪽이다. 사이트 전체를 어디부터 볼지가 궁금하면
[jay-wiki 한눈에 보기](/wiki/jaywiki-main-map)로 돌아간다.
