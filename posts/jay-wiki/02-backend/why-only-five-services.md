---
title: "Eureka·Config Server·메시를 각각 기각하고 워크로드 다섯에서 멈췄다"
slug: why-only-five-services
tab: "백엔드"
parentId: backend
sortOrder: 7
kind: wiki
tags: msa,architecture,kubernetes,gateway,tradeoff
source: scripts/seed-portfolio-wiki.mjs
---
- 이 클러스터의 애플리케이션 워크로드는 다섯이다 — Next.js web, Spring 모놀리스, payment-api, shipping-api, partner-simulator. 왜 더 없나?
- Eureka·Config Server·서비스 메시·별도 gateway 를 각각 따져 보고, 전부 "Kubernetes 나 기존 코드가 이미 하는 일"이라 안 넣었다. 개수를 늘리는 대신 데이터 소유권을 실제로 나누는 쪽을 골랐다.
- infra/k8s/backend 와 infra/k8s/frontend 의 Deployment 매니페스트 다섯 개, 그리고 BFF 프록시 route.ts 77줄이 근거다.

MSA 포트폴리오의 흔한 모양은 서비스 열 개에 Eureka, Config Server, Gateway, 메시까지
Netflix OSS 상자를 전부 얹는 쪽이다. 이 프로젝트는 반대로 갔다. 워크로드는 다섯에서 멈췄고,
등록 서버도 설정 서버도 메시도 없다. 이 글은 그 다섯이 게으름이 아니라 판단이라는 것을
컴포넌트별로 보인다.

## 실제로 뜨는 것은 Deployment 다섯이다

infra/k8s 매니페스트를 직접 세면 애플리케이션 워크로드는 다섯이다.

| 워크로드 | 매니페스트 | 무엇 |
|---|---|---|
| jaywiki-web | frontend/jaywiki-web.yaml | Next.js. 위키·블로그 화면과 BFF 프록시 |
| jaywiki | backend/jaywiki.yaml | Spring 모놀리스. 인증·위키·사가 오케스트레이션 |
| jaywiki-payment-api | backend/jaywiki-payment-api.yaml | FastAPI. 결제 데이터 소유 |
| jaywiki-shipping-api | backend/jaywiki-shipping-api.yaml | FastAPI. 배송 데이터 소유 |
| jaywiki-partner-simulator | backend/jaywiki-partner-simulator.yaml | 파트너 API 회복탄력성 리허설 상대역 |

backend 디렉터리의 나머지 둘(jaywiki-hpa.yaml, jaywiki-control-rbac.yaml)은 HPA 와 RBAC 라
워크로드가 아니다. 그리고 다섯 중 partner-simulator 는 사가와 무관하다 — 호출자가 전부
domainlab 패키지다. 사가 흐름을 건너는 프로세스는 모놀리스·payment-api·shipping-api 셋이다.
전체 지도는 [첫 화면 오케스트레이션 지도](/wiki/orchestration-map-walkthrough)에 있다.

데이터 계층은 이 다섯에 안 센다. postgres·pg-services·Redis·OpenSearch·MinIO·Kafka 는
전부 뜨지만 남의 소프트웨어를 운영하는 것이지 이 저장소가 만든 서비스가 아니다.
아래에서 "안 넣었다"고 따지는 대상도 애플리케이션 워크로드 쪽이다.

## Eureka 를 안 넣은 이유 — 디스커버리는 Service DNS 가 이미 한다

Eureka 가 푸는 문제는 "인스턴스가 어디 떠 있는지 모른다"이다. VM 시절에는 실제 문제였다.
그런데 Kubernetes 에서는 Service 가 그 일을 한다. 모놀리스는 payment-api 를
jaywiki-payment-api 라는 Service 이름으로 부르고, DNS 가 파드가 어디서 다시 뜨든 따라간다.
셀렉터가 레지스트리고, kube-proxy 가 클라이언트 사이드 로드밸런서다.

여기에 Eureka 를 얹으면 등록 서버 파드 하나, 서비스마다 등록 클라이언트 설정,
하트비트 트래픽이 생기는데, 얻는 것은 이미 있는 기능의 두 번째 사본이다.
주소가 고정된 서비스 다섯에 레지스트리 서버를 따로 두는 것은 답이 없는 비용이다.

## Config Server 를 안 넣은 이유 — 설정은 ConfigMap 과 env 로 끝난다

Spring Cloud Config 가 값지는 조건은 둘이다. 설정을 배포 없이 갱신해야 하거나,
수십 개 서비스가 공통 설정을 나눠 가져야 하거나. 여기는 둘 다 아니다.

설정은 application-prod.yml 과 env 로 끝나고, 갱신 주기가 배포 주기와 같다.
값이 바뀌는 경로는 매니페스트의 ConfigMap·Secret 수정 → 재배포 하나뿐이고,
그 흐름은 [매니페스트를 서비스 경계로 나눈 기준](/wiki/k3s-manifest-boundaries)에 이미 있다.
Config Server 를 넣으면 그 서버가 새로운 단일 장애점이 된다 — 설정 서버가 죽으면
서비스 재시작이 전부 막힌다. 배포 주기와 설정 주기가 같은 시스템에서 감수할 이유가 없다.

## 서비스 메시를 안 넣은 이유 — 노드 하나에서 사이드카는 비용만 는다

메시가 파는 것은 mTLS, 트래픽 셰이핑, 자동 계측이다. 대가는 파드마다 붙는 사이드카다.
이 클러스터는 [miniPC 한 대](/wiki/minipc-boundary-decision) 위의 단일 노드 k3s 라
서비스 간 트래픽이 노드를 떠나지 않는다. 그 구간에 mTLS 를 깔아서 지키는 경계가 없다.

관측은 이미 다른 길로 해결돼 있다. 프로세스들이 OTel 로 트레이스를 collector 를 거쳐 Tempo 로 내보내서,
메시가 자동 계측으로 줄 것을 코드가 이미 주고 있다. 남는 이점이 없는데 사이드카 메모리와
운영할 컨트롤 플레인만 늘어난다. 트래픽이 노드를 건너기 시작하면 그때 다시 따진다.

## gateway 는 추가가 아니라 대체다 — 그래서 아직 없다

넷 중 gateway 만 결론이 "영영 안 넣는다"가 아니다. 넣는 방식이 하나로 못박혀 있을 뿐이다.

지금 요청 경로는 이미 입구가 둘이다.

~~~
브라우저 → traefik(ingress) → Next.js → BFF 라우트 → Spring
브라우저 → traefik(ingress) → Spring                      (/ws/chat 만)
~~~

둘째 줄이 우회다. WebSocket 은 Next 의 라우트 핸들러를 못 지나서, infra/k8s/backend/jaywiki.yaml 에
jaywiki-chat 이라는 Ingress 객체가 따로 서서 /ws/chat 을 Spring 으로 직접 보낸다. BFF 가 입구를
하나로 모으는 물건인데 이 경로만 예외인 것이고, 예외를 유지하는 값은 ingress 규칙 하나다.

여기에 Spring Cloud Gateway 를 추가하면 5홉이 되고, 그건 어거지다. 왜냐하면
web/src/app/api/bff/[...path]/route.ts 가 이미 게이트웨이의 일을 하고 있기 때문이다.

| route.ts | 하는 일 | gateway 라면 |
|---|---|---|
| 12행 | 백엔드 주소 은폐 | 라우팅 정의 |
| 18-23행 | 인증 쿠키(jw_token)와 cf-connecting-ip·x-forwarded-for 전달 | 기본 동작 + 필터 |
| 32-46행 | 백엔드 다운 시 problem+json 502 래핑 | CircuitBreaker + fallbackUri |
| 50-55행 | x-cache·x-search-engine 응답 헤더 통과 | 기본 동작 |
| 57-59행 | 로그인의 Set-Cookie 를 브라우저로 되돌림 | 기본 동작 |

정확한 서술은 "BFF 가 뭘 했나"가 아니라 "게이트웨이의 일을 Next 가 대신하고 있었다"다.
그래서 gateway 를 넣는 유일하게 정당한 형태는 이 파일을 걷어내는 대체다.

~~~
브라우저 → traefik → gateway → Spring / payment-api / shipping-api
~~~

홉 수는 그대로고, 새 계층이 아니라 역할이 제자리로 옮겨 간다. 다만 이 대체가 정당해지는 조건은
서비스 개수가 아니다.

그 조건을 세어 봤다. payment-api 와 shipping-api 를 부르는 코드는 저장소 전체에서 두 곳,
PaymentClient 와 ShippingClient 뿐이고 둘 다 OrderSagaService 안에서 불린다. web 쪽에는
그 주소를 아는 코드가 없다 — 시나리오 화면이 이름을 문자열로 적을 뿐이다. 즉 브라우저가 고를 수 있는
목적지는 지금도 Spring 하나이고, 오늘 gateway 를 세워도 라우팅 테이블에 줄이 하나다.

그래서 계획의 마지막 단계로 남겨 뒀다. 남은 근거는 위의 우회 하나다 — gateway 가 서면
/ws/chat 이 별도 Ingress 를 가질 이유가 없어지고 입구가 실제로 하나가 된다. 그 한 줄을 없애려고
컴포넌트를 세우는 것이 남는 장사인지는 아직 아니라고 본다. 라우팅 수요가 생기는 쪽이 먼저다.
인증은 대체 후에도
gateway 로 올리지 않는다 — TOTP 검증은 Spring 에 남는다. 그 경계가 왜 거기 있는지는
[Spring 과 BFF 의 인증 경계](/wiki/spring-bff-auth-boundary)에 있다.

그 파일을 줄 단위로 읽고 게이트웨이 기능 목록과 대조한 기록, 그리고 전환할 때 무엇이 위험한지는
[Spring Cloud Gateway 를 넣을 자리에 BFF 프록시가 이미 서 있었다](/wiki/bff-was-already-the-gateway)에 따로 있다.

## 서비스 개수는 성숙도가 아니다

넷을 안 넣은 근거는 결국 하나로 모인다. 상자를 늘리는 것과 분리를 해내는 것은 다른 축이다.

이 프로젝트도 한때 프로세스 분리·독립 배포·비동기 통신·분산 추적을 다 갖추고 있었지만,
결제 데이터의 원본은 모놀리스 DB 에 있었다. 그 상태에서 서비스를 열로 늘려도
같은 DB 를 보는 모놀리스가 열 조각 난 것뿐이다. 그래서 개수 대신 소유권을 골랐다 —
payment-api 와 shipping-api 는 각자 pg-services 의 자기 DB 만 갖고, 모놀리스는
그 데이터를 이벤트로 받은 프로젝션으로만 읽으며, NetworkPolicy 와 DB 계정 두 겹이
그 약속을 강제한다. 여섯째 서비스 하나보다 이 두 겹이 만들기 어려웠고, 보여주는 것도 많다.

user-api 를 안 만든 것도 같은 판단이다. 세 번째 FastAPI 서비스는 payment·shipping 과
같은 패턴의 복제라 새로 보여줄 것이 없고, 인증을 빼내는 순간 로그인이 깨질 위험이
이 계획에서 가장 큰데 얻는 것이 가장 적다.

## 남은 한계 — 기각 근거는 오늘의 조건에 묶여 있다

- gateway 대체는 아직 실행 전이다. "BFF 를 걷어내면 홉이 안 는다"는 판단은 표 위에서만
  검증됐고, Set-Cookie 되돌리기가 gateway 기본 동작으로 충분한지는 대체해 봐야 안다
- 라우팅 목적지가 하나라는 근거는 오늘의 호출 관계를 센 것이다. 브라우저가 payment-api 를
  직접 부를 일이 생기면 그날로 뒤집힌다. 세는 방법은 위에 적었으니 다시 세면 된다
- 서비스 메시의 기각 근거는 "노드가 하나"라는 현재 조건에 묶여 있다. 노드가 늘면
  mTLS 부재가 실제 구멍이 되므로 이 글의 결론이 뒤집힌다
- partner-simulator 는 다섯에 세지만 사가 밖이다. 지도에서 이 구분이 안 보이면
  "서비스 다섯" 자체가 부풀린 수로 읽힐 수 있다
- Config Server 기각은 "갱신 주기가 배포 주기와 같다"에 기대고 있다. 배포 없이
  바꾸고 싶은 값이 처음 생기는 날, 이 항목만 다시 열린다
