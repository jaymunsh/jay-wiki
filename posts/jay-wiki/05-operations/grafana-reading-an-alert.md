---
title: "Grafana 화면을 열어 알림 하나를 끝까지 읽은 기록"
slug: grafana-reading-an-alert
tab: "운영·관측"
parentId: operations
sortOrder: 1
kind: wiki
tags: grafana,prometheus,loki,tempo,promql,observability
source: scripts/seed-portfolio-wiki.mjs
---
- Grafana 화면을 열면 무엇이 있고, 원인을 모르는 알림 하나를 어떤 순서로 좁히나?
- 대시보드는 상태를 보는 자리이고 알림을 좁히는 자리는 Explore이며, 서로 다른 신호는 trace_id 하나로 이어지도록 datasource 설정에 다리를 걸어 두었다.
- 2026-09-06 18:04 의 400 알림을 Explore 에서 status 별로 갈라 200 3건·400 4건·409 2건을 확인했고, 로그가 없어 다리는 끊겼지만 Tempo 를 직접 검색해 같은 아홉 건을 건별 상태 코드와 소요 시간까지 되찾았다.

이 프로젝트에는 관측 스택이 있고, 알림도 온다.

그런데 2026-09-06 에 400 알림을 받고 나서 내가 연 것은 Grafana 가 아니라 터미널이었다. 알림 문구에
"Grafana - Explore - Loki 에서 확인합니다" 라고 적혀 있는데도 kubectl 과 curl 로 갔다. **화면을 세워 둔
것과 그 화면을 쓸 줄 아는 것은 별개였다.** 이 글은 그 화면을 실제로 열어 같은 알림을 다시 읽은 기록이다.

수집 경로와 공개 범위는 [Metrics·Logs·Traces를 연결한 관측 경계](/wiki/observability-loki-tempo-grafana)에 있다.
이 글은 그 위에서 **사람이 화면을 어떻게 쓰는지**만 다룬다.

## Grafana 는 데이터를 갖고 있지 않다

먼저 오해를 하나 걷어내야 한다. Grafana 는 저장소가 아니다. **질의를 대신 던져 주고 결과를 그려 주는
창**이고, 실제 데이터는 전부 다른 곳에 있다.

Connections - Data sources 를 열면 무엇을 보고 있는지가 그대로 나온다.

![Grafana 의 Data sources 화면. Loki, Prometheus, Tempo 셋이 모두 클러스터 내부 주소로 연결돼 있고 Prometheus 에 default 배지가 붙어 있다](/assets/observability/grafana-datasources.png "width=760 align=center")

| datasource | 주소 | 담는 것 |
|---|---|---|
| Prometheus (default) | prom-prometheus-server.obs.svc.cluster.local | 수치. 요청 수, 지연, 자원 |
| Loki | loki.obs.svc.cluster.local:3100 | 로그 원문 |
| Tempo | tempo.obs.svc.cluster.local:3200 | 요청 하나가 지나간 경로 |

셋 다 ClusterIP 주소다. **브라우저가 이 주소로 직접 붙는 것이 아니라 Grafana 서버가 대신 붙는다**
(access: proxy). 그래서 저장소들을 클러스터 밖으로 열지 않고도 화면이 돈다.

셋 다 editable: false 로 잠가 두었다. 화면에서 고쳐도 다음 배포가 되돌리므로, 바꿀 일이 있으면
infra/k8s/observability/grafana-values.yaml 을 고친다.

## 로그인은 두 겹이다

주소는 grafana.leneu.cloud 이고 Traefik ingress 로 들어간다. 그 앞에 문이 둘 있다.

~~~mermaid
flowchart TB
    A[브라우저] --> B[Cloudflare Access]
    B --> C[Grafana 자체 로그인]
    C --> D[대시보드와 Explore]
~~~

첫 겹은 Cloudflare Access 다. 로그인하지 않았으면 jaymunsh.cloudflareaccess.com 으로 튄다.
두 번째 겹이 Grafana 계정이고, 비밀번호는 obs 네임스페이스의 grafana-admin Secret 에 있다.

**Grafana 화면에서 비밀번호를 바꾸면 Secret 과 어긋난다.** 재설치나 값 변경 때 되돌아가므로 둘을
같이 바꿔야 한다.

## 화면은 Dashboards 와 Explore 둘로 갈린다

왼쪽 메뉴에 항목이 여럿이지만 실제로 쓰는 것은 둘이다. **이 구분이 이 글에서 가장 중요하다.**

| 자리 | 쓰는 때 | 성격 |
|---|---|---|
| Dashboards | 평소에 상태를 훑을 때 | 미리 정해 둔 질문의 답만 보여준다 |
| Explore | 원인을 모르는 알림을 받았을 때 | 질문을 그 자리에서 만든다 |

대시보드는 **누군가 미리 물어 둔 질문**이다. 그래서 알림이 왔을 때 대시보드만 보면 답이 안 나오는
경우가 많다. 그 알림이 묻는 질문을 아무도 미리 패널로 만들어 두지 않았기 때문이다.

## 대시보드는 Jaywiki 폴더에 둘뿐이다

![Grafana 의 Jaywiki 폴더. Jaywiki Kafka Demo 와 Jaywiki RED 두 대시보드가 태그와 함께 나열돼 있다](/assets/observability/grafana-dashboard-list.png "width=760 align=center")

둘 다 손으로 만든 것이 아니라 Helm values 에 JSON 으로 박아 둔 것이다. 그래서 클러스터를 다시 세워도
같은 대시보드가 그대로 살아난다.

### Jaywiki RED 는 네 가지를 묻는다

RED 는 Rate, Errors, Duration 의 머리글자다. 서비스 상태를 볼 때 이 셋을 먼저 본다는 관례에서 왔다.

![Jaywiki RED 대시보드. Backend Rate 0.737 req/s, Backend Errors 는 No data, Backend Duration p95 27.8 ms, Backend Up 두 파드 모두 1, Node Memory 40.4 퍼센트, Running Pods 는 네임스페이스별로 나뉘어 있다](/assets/observability/grafana-red-dashboard.png "width=760 align=center")

패널마다 어떤 질의가 들어 있는지 적어 둔다. **패널 제목만 보면 무엇을 세는지 알 수 없다.**

| 패널 | 질의 | 이 값이 뜻하는 것 |
|---|---|---|
| Backend Rate | sum(rate(http_server_requests_seconds_count{job="jaywiki-backend"}[5m])) | 초당 요청 수. 캡처 시점 0.737 req/s |
| Backend Errors | 5xx 요청 비율을 전체로 나눈 값 | 실패 비율. 캡처 시점 No data |
| Backend Duration p95 | histogram_quantile(0.95, ...) | 느린 쪽 5퍼센트의 응답 시간. 27.8 ms |
| Backend Up | up{job="jaywiki-backend"} | 파드가 스크레이프에 응답하는가. 둘 다 1 |
| Node Memory | 1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) | 노드 메모리 사용률. 40.4 퍼센트 |
| Running Pods | 네임스페이스별 Running 파드 수 | backend 5, data 6, frontend 1, obs 9 |

Backend Rate 가 0.737 req/s 로 거의 평평하다는 점이 눈에 띈다. **사람이 만든 트래픽이 아니다.**
대부분 헬스체크와 Prometheus 스크레이프이고, 그 위에 프런트엔드의 주기적 호출이 얹혀 있다. 이 평평한
바닥이 뒤에서 쓸모가 있다 — 바닥이 일정해야 사람 한 명이 들어왔을 때 튀는 것이 보인다.

## 패널 하나를 파고드는 길이 넷이다

대시보드는 읽고 끝내는 화면이 아니다. 패널 제목 옆 메뉴를 열면 그 자리에서 더 들어갈 수 있다.

![Jaywiki RED 의 Backend Rate 패널 메뉴를 연 화면. Edit, Share, Explore, Inspect, More 항목이 나열돼 있다](/assets/observability/grafana-panel-menu.png "width=760 align=center")

| 길 | 무엇을 하나 | 언제 쓰나 |
|---|---|---|
| 드래그 확대 | 그래프에서 구간을 끌면 그 시간대만 다시 그린다 | 튄 지점의 모양을 자세히 볼 때 |
| Inspect - Data | 그래프 뒤의 실제 숫자를 표로 본다 | 눈금으로는 안 읽히는 값을 확인할 때 |
| Inspect - Query | Grafana 가 보낸 질의 원문과 응답을 본다 | 패널이 이상할 때 질의를 의심할 때 |
| Explore | 그 패널의 질의를 들고 Explore 로 넘어간다 | 질의를 고쳐 가며 파고들 때 |

시간 축을 좁히는 것부터 해 본다. 그래프 위에서 구간을 끌면 그만큼만 다시 그린다.

![Backend Rate 그래프에서 일부 구간을 드래그해 확대한 화면](/assets/observability/grafana-panel-zoom.png "width=760 align=center")

Inspect - Data 를 열면 그림 뒤의 숫자가 그대로 나온다.

![Backend Rate 패널의 Inspect Data 화면. 15초 간격으로 0.733에서 0.740 req/s 사이의 값이 표로 나열돼 있고 Download CSV 단추가 있다](/assets/observability/grafana-panel-inspect.png "width=760 align=center")

15초 간격으로 0.733에서 0.740 req/s 사이를 오간다. **그래프에서 요철처럼 보이던 것이 실제로는
소수점 세 자리 차이였다.** 세로 축이 좁은 범위로 자동 조정돼 있어서 크게 흔들리는 것처럼 보인 것이다.
Stats 탭에는 질의에 걸린 시간과 받은 데이터 크기가, JSON 탭에는 패널 정의 전체가 있다.

Explore 로 보내면 패널의 질의가 그대로 실려 온다.

![패널 메뉴의 Explore 로 넘어간 화면. 질의창에 Backend Rate 패널의 PromQL 이 그대로 들어와 있고 Explain 토글이 켜져 세 단계로 풀어서 설명하고 있다](/assets/observability/grafana-panel-to-explore.png "width=760 align=center")

**여기서부터는 질의를 마음대로 고칠 수 있다.** 라벨을 하나 추가해 쪼개 보거나, 시간 범위를 어제로
돌리거나, 다른 지표와 나란히 놓을 수 있다. 대시보드에서는 못 하는 일이다.

Explain 토글을 켜 두면 PromQL 을 한 줄씩 풀어서 설명한다. 위 캡처에서는 세 단계로 나뉘어 있다 —
라벨에 맞는 시계열을 모으고, rate 로 초당 증가율을 구하고, sum 으로 합친다. **PromQL 이 익숙하지
않을 때 이 토글이 가장 쓸모 있다.**

## No data 는 두 가지로 읽힌다

Backend Errors 패널이 No data 다. 이것을 "오류가 0건이다" 로 읽으면 안 된다. **정확히는
"5xx 시계열이 아예 존재하지 않는다" 는 뜻이다.**

status=~"5.." 에 맞는 요청이 한 번도 없으면 그 라벨 조합의 시계열이 생기지 않고, 없는 것을 나누면
결과도 없다. 그래서 값 0 이 아니라 No data 가 나온다.

문제는 **패널이 깨졌을 때도 화면이 똑같다**는 것이다. 지금은 건강해서 비어 있지만, 질의를 잘못
고쳤거나 job 이름이 바뀌어도 같은 글자가 보인다. 둘을 구별하려면 옆 패널을 봐야 한다. Backend Up 이
1 이고 Backend Rate 에 값이 있으면 수집은 살아 있는 것이므로, 그때의 No data 는 건강하다는 뜻이다.

Kafka 대시보드는 다섯 패널이 전부 No data 다.

![Jaywiki Kafka Demo 대시보드. Order Events, Consumer Results, DLQ Total, Consumer Processing p95, Outbox Publish Results 다섯 패널이 모두 No data 로 비어 있다](/assets/observability/grafana-kafka-dashboard.png "width=760 align=center")

이쪽은 이유가 다르다. **Kafka 데모는 사람이 시나리오를 돌릴 때만 이벤트를 만든다.** 평소에는 아무도
주문을 넣지 않으니 지표가 안 생긴다. 즉 이 대시보드는 고장 난 것이 아니라 **데모를 돌리는 동안에만
의미가 있는 화면**이다.

같은 No data 인데 하나는 건강의 증거이고 하나는 유휴 상태의 표시다. **화면 글자만으로는 못 가른다.**

## 신호 사이에 다리가 셋 있다

metric 에서 이상을 발견해도 원인은 로그나 trace 에 있다. 그래서 datasource 설정에 서로 건너가는
다리를 걸어 두었다.

~~~mermaid
flowchart TB
    P[Prometheus<br/>언제 무엇이 튀었나] --> L[Loki<br/>그때 무슨 로그가 남았나]
    L -->|로그 줄의 trace_id 를 눌러| T[Tempo<br/>그 요청이 지나간 경로]
    T -->|해당 시각의 로그로 되돌아가기| L
    T -->|Service Graph| P
~~~

| 다리 | 어떻게 걸었나 | 화면에서 하는 일 |
|---|---|---|
| Loki에서 Tempo로 | derivedFields 가 로그에서 trace_id=(32자리 16진수) 를 정규식으로 잡는다 | 로그 줄에 trace_id 링크가 생기고 누르면 Tempo 로 간다 |
| Tempo에서 Loki로 | tracesToLogsV2. 앞뒤 5분을 넓혀 보고 같은 trace 만 거른다 | span 을 보다가 그 시각의 로그로 되돌아간다 |
| Tempo에서 Prometheus로 | serviceMap | 서비스 사이 호출 관계를 그림으로 본다 |

**핵심은 trace_id 다.** 애플리케이션이 로그 줄마다 trace_id 를 찍어 주기 때문에 이 다리가 성립한다.
찍지 않으면 세 신호는 각자 따로 노는 화면 셋일 뿐이다.

## Tempo 화면은 요청 하나의 안쪽을 보여준다

Prometheus 가 "몇 건이 얼마나 걸렸나" 를 답한다면, Tempo 는 **그 한 건이 안에서 무엇을 했나** 를 답한다.
Explore 에서 datasource 를 Tempo 로 바꾸면 질의 방식이 셋 있다.

| Query type | 무엇을 하나 |
|---|---|
| Search | Service Name, Span Name, Status, Duration 같은 칸을 채워 찾는다 |
| TraceQL | 조건을 문법으로 직접 쓴다. 중괄호 안에 조건을 넣는다 |
| Service Graph | 서비스 사이 호출 관계를 표와 그림으로 본다 |

Search 로 서비스 이름만 jaywiki 로 두고 조회하면 최근 trace 목록이 나오고, 하나를 누르면 오른쪽에
span 이 펼쳐진다.

![Grafana Explore 의 Tempo 화면. 왼쪽에 trace 목록이 있고 오른쪽에 선택한 trace 의 span 다섯 개가 시간 축 위에 막대로 펼쳐져 있다](/assets/observability/grafana-tempo-trace.png "width=760 align=center")

캡처의 trace 는 헬스체크 요청 하나이고 전체 1.14ms 인데, 그 안이 다섯 조각으로 나뉘어 있다.

| span | 걸린 시간 |
|---|---:|
| http get /actuator/health/** (전체) | 1.14 ms |
| security filterchain before | 237.26 µs |
| authorize request | 61.32 µs |
| secured request | 511.19 µs |
| security filterchain after | 91.5 µs |

**Spring Security 필터 체인이 통째로 보인다.** 요청 하나가 인가 검사에 얼마를 쓰고 실제 처리에 얼마를
썼는지가 갈린다. 지연이 생겼을 때 어느 조각이 늘었는지 짚을 수 있다는 뜻이다.

Service Graph 는 관계를 본다.

![Grafana Explore 의 Tempo Service Graph 화면. 위쪽 표에 경로별 초당 요청 수와 p90 지연이 있고 아래 노드 그래프에 user 에서 jaywiki, jaywiki-payment-api, jaywiki-shipping-api 로 화살표가 뻗어 있다](/assets/observability/grafana-tempo-servicegraph.png "width=760 align=center")

| 서비스 | 초당 요청 | 평균 응답 |
|---|---:|---:|
| jaywiki | 0.73 r/sec | 11.74 ms |
| jaywiki-payment-api | 0.22 r/sec | 3.31 ms |
| jaywiki-shipping-api | 0.22 r/sec | 3.05 ms |

**이 화면이 앞의 숫자를 교차 확인해 준다.** jaywiki 의 0.73 r/sec 은 Jaywiki RED 의 Backend Rate
0.737 req/s 와 같은 값이다. 서로 다른 저장소에서 다른 방식으로 센 수치가 맞는다는 뜻이라, 둘 중
하나가 틀렸을 가능성을 지운다.

표를 보면 트래픽의 정체도 드러난다. 상위 다섯 중 넷이 /health/ready, /actuator/health, /metrics 같은
점검 경로이고, 사람이 볼 만한 것은 /api/articles/{slug} 와 /api/tabs 둘뿐인데 각각 0.150 r/sec 이다.
**분당 정확히 9회다.** 앞에서 Backend Rate 가 평평했던 이유가 여기서 확인된다.

## 400 알림 하나를 Explore 에서 끝까지 읽는다

이제 실제 알림으로 해 본다. 2026-09-06 18:04:01 에 온 알림은 이랬다.

~~~text
[jay-wiki] JaywikiApi400Observed
내용: 400 잘못된 요청 · POST /api/auth/register
~~~

대시보드에는 답이 없다. **어느 패널도 엔드포인트별 상태 코드를 세고 있지 않기 때문이다.** 그래서
Explore 로 간다.

### 첫걸음: 그 경로의 상태 코드를 전부 센다

400 만 보면 "누가 실패했다" 까지밖에 안 나온다. status 라벨로 갈라서 같이 봐야 한다.

~~~text
sum by (status) (http_server_requests_seconds_count{uri="/api/auth/register"})
~~~

![Grafana Explore 에서 Prometheus 로 회원가입 경로의 상태 코드를 센 화면. 17시부터 20시 구간에서 200, 400, 409 세 선이 18시 5분에 동시에 계단처럼 올라간 뒤 평평하다](/assets/observability/grafana-explore-prometheus.png "width=760 align=center")

한 화면에서 다섯 가지가 읽힌다.

- **세 선이 있다.** 200 과 400 과 409 다. 실패만 있었던 것이 아니다
- **셋이 같은 지점에서 올라간다.** 18:05 한 곳뿐이고 앞뒤로는 완전히 평평하다
- **높이가 각각 3, 4, 2 다.** 성공 3건, 거절 4건, 아이디 충돌 2건
- **그 뒤로 다시 안 오른다.** 반복 시도가 아니다
- **17시 이전에는 선 자체가 없다.** 이 엔드포인트는 그날 처음 불렸다

409 가 섞여 있다는 것이 특히 중요하다. **이미 사용 중인 아이디라는 뜻이고, 봇이라면 나올 이유가 없는
응답이다.** 성공과 거절과 충돌이 2분 안에 섞여 있고 마지막이 성공이면, 사람이 폼 앞에서 고쳐 가며
입력한 모양이다.

### 둘째 걸음: 400 이 어느 갈래인지 라벨로 가른다

같은 400 이라도 원인이 둘이다. 질의에 exception 라벨을 추가하면 갈린다.

| exception 값 | 무슨 뜻인가 | 우리 잘못인가 |
|---|---|---|
| HttpMessageNotReadableException | 요청 본문을 못 읽었다 | 보낸 쪽이 우리 화면이면 우리 버그다 |
| none | 컨트롤러가 값을 보고 스스로 거절했다 | 아니다. 검증이 동작한 것이다 |

질의에 exception 을 라벨로 추가해 돌린 화면이다.

![Grafana Explore 에서 status 와 exception 두 라벨로 쪼갠 화면. 아래 Raw 표에 exception=none 이면서 status 가 400 인 것 4건, 200 인 것 3건, 409 인 것 2건 세 줄만 있다](/assets/observability/grafana-explore-exception.png "width=760 align=center")

**Raw 표에 시리즈가 셋뿐이고 셋 다 exception 이 none 이다.** HttpMessageNotReadableException 은
아예 나오지 않았다. 그러면 AuthController 에서 400 을 내는 자리 둘 중 하나다 — 아이디 규칙
위반이거나 비밀번호 8자 미만이다. **여기서 조사가 끝난다. 고칠 버그가 없다.**

알림 문구는 "unreadable request body 로 확인합니다" 라고 안내하고 있었는데, 이번 건은 그 갈래가
아니었다. **알림이 가리킨 곳이 항상 답이 있는 곳은 아니다.**

### 셋째 걸음: 로그로 건너가려다 멈춘다

다리를 타려면 로그가 있어야 한다. 같은 시간대의 backend 네임스페이스를 열어 봤다.

![Grafana Explore 에서 Loki 로 backend 네임스페이스 로그를 같은 시간대에 조회한 화면. 6,300줄이 고르게 쌓여 있지만 내용은 전부 health/ready 와 metrics 요청이다](/assets/observability/grafana-explore-loki.png "width=760 align=center")

**비어 있지 않다. 6,300줄이 있다.** 그런데 내용을 보면 전부 GET /health/ready 와 GET /metrics 다.
FastAPI 서비스들이 남기는 접근 로그이고, 이번 사건과는 아무 관계가 없다.

정작 요청을 받은 Spring 앱은 한 줄도 안 남겼다. app="jaywiki" 로 좁혀 보면 마지막 줄이
2026-09-04 19:33 이다. 파드가 뜬 순간의 기동 로그가 끝이다.

이유는 단순하다. **Spring MVC 는 4xx 를 예외로 취급하지 않는다.** 컨트롤러가 400 을 돌려주고 끝나면
정상적인 응답 흐름이고 로거가 관여하지 않는다. 접근 로그도 켜 두지 않았다.

로그가 없으니 trace_id 도 없고, trace_id 가 없으니 **로그에서 Tempo 로 건너가는 다리를 못 탄다.**
알림 문구가 안내한 경로는 여기서 끊긴다.

### 넷째 걸음: 다리 대신 Tempo 를 직접 검색한다

다리가 끊겼다고 Tempo 를 못 보는 것은 아니다. **로그를 거치지 않고 Tempo 에서 바로 찾으면 된다.**
trace 는 로그와 별개로 앱이 직접 보내기 때문이다. 샘플링이 1.0 이라 모든 요청이 남고, 보존은 24시간이다.

TraceQL 로 span 이름을 짚어 그 시간대를 조회한다.

~~~text
{resource.service.name="jaywiki" && name="http post /api/auth/register"}
~~~

![Grafana Explore 의 Tempo TraceQL 화면. 2026-09-06 18시부터 18시 10분 구간에 회원가입 요청 trace 아홉 건이 Trace ID, 시각, Duration 과 함께 표로 나열돼 있고 소요 시간이 1ms 부터 350ms 까지 흩어져 있다](/assets/observability/grafana-tempo-register-list.png "width=760 align=center")

**아홉 건이 그대로 남아 있었다.** 그리고 metric 보다 나은 점이 하나 있었다. metric 은 상태 코드별
합계만 주는데, **trace 는 건마다 따로 있어서 순서와 간격과 개별 소요 시간이 보인다.**

span 을 열면 속성에 상태 코드가 박혀 있다. 추정할 필요가 없다.

| 시각 | 상태 | outcome | 소요 |
|---|---:|---|---:|
| 18:03:41 | 400 | CLIENT_ERROR | 5.0 ms |
| 18:03:53 | 200 | SUCCESS | 350.2 ms |
| 18:04:09 | 200 | SUCCESS | 176.4 ms |
| 18:04:20 | 409 | CLIENT_ERROR | 3.3 ms |
| 18:04:23 | 409 | CLIENT_ERROR | 3.7 ms |
| 18:04:26 | 400 | CLIENT_ERROR | 2.3 ms |
| 18:04:27 | 400 | CLIENT_ERROR | 2.1 ms |
| 18:04:30 | 400 | CLIENT_ERROR | 1.7 ms |
| 18:04:33 | 200 | SUCCESS | 225.5 ms |

400 이 넷, 409 가 둘, 200 이 셋이다. **앞에서 metric 으로 센 것과 정확히 맞는다.** 서로 다른
저장소가 다른 방식으로 센 값이 일치하므로, 둘 중 하나가 틀렸을 가능성이 지워진다.

### 소요 시간이 코드 경로를 드러낸다

세 무리로 갈린다. **어느 지점까지 갔다가 돌아섰는지가 시간에 그대로 찍힌다.**

| 무리 | 소요 | 어디까지 갔나 |
|---|---|---|
| 400 | 1.7~2.3 ms | 컨트롤러 첫 줄의 형식 검사에서 끝. DB 를 안 본다 |
| 409 | 3.3~3.7 ms | 아이디 중복 확인을 위해 DB 를 한 번 읽고 돌아섬 |
| 200 | 176~350 ms | BCrypt 해싱과 INSERT 까지 |

400 과 409 사이의 1.5 ms 남짓이 **조회 한 번의 값**이고, 409 와 200 사이의 200 ms 남짓이
**해싱과 저장의 값**이다. BCrypt 는 무차별 대입을 늦추려고 일부러 느리게 설계된 알고리즘이라
이 구간이 크게 벌어진다.

첫 400 만 5.0 ms 로 나머지의 두 배다. **그 엔드포인트가 그날 처음 불린 요청이라** 클래스 로딩과
JIT 이 섞였다. 두 번째부터 2 ms 대로 내려간다.

### 성공과 거절을 나란히 펼쳐 본다

목록에서 한 건을 누르면 오른쪽에 span 이 펼쳐진다. 먼저 350 ms 짜리다.

![성공한 회원가입 요청의 trace 상세. 전체 350.15ms 중 secured request 가 348.68ms 를 차지하고 보안 필터 관련 span 셋은 마이크로초 단위다](/assets/observability/grafana-tempo-register-trace.png "width=760 align=center")

같은 화면에서 2 ms 짜리를 열면 이렇다.

![거절된 회원가입 요청의 trace 상세. 전체 2.31ms 이고 secured request 가 1.35ms 다. span 구성은 성공한 요청과 똑같다](/assets/observability/grafana-tempo-register-400.png "width=760 align=center")

**span 구성이 똑같다.** 둘 다 다섯 조각이고 이름도 같다. 다른 것은 길이 하나뿐이다.

| span | 200 (350 ms) | 400 (2.31 ms) |
|---|---:|---:|
| http post /api/auth/register | 350.15 ms | 2.31 ms |
| secured request | 348.68 ms | 1.35 ms |
| security filterchain before | 462.58 µs | 302.42 µs |
| authorize request | 74.31 µs | 52.8 µs |
| security filterchain after | 74.87 µs | 113.57 µs |

**보안 필터 체인은 둘 다 0.3~0.5 ms 로 비슷하다.** 인증을 안 걸어 둔 공개 엔드포인트라 통과 비용이
거의 고정이다. 차이는 전부 secured request 안에 있다 — 348.68 ms 대 1.35 ms, 258배다.

### 그런데 그 안쪽이 비어 있다

여기서 막힌다. **348 ms 가 secured request 한 덩어리로 뭉쳐 있고 그 아래가 없다.** BCrypt 해싱이
얼마를 쓰고 INSERT 가 얼마를 썼는지 화면에 안 나온다. JDBC 계측을 안 켜 두었기 때문이다.

지금은 다른 상태 코드와 비교해서 메울 수는 있다. 409 가 DB 조회 한 번에 3 ms 대였으니 INSERT 도
그 언저리일 것이고, 나머지 340 ms 남짓이 해싱이라고 보는 것이 자연스럽다. **하지만 그건 추론이고,
계측을 켜면 사실이 된다.**

### 그래서 무엇을 배웠나

**세 신호 중 둘로 답이 나왔다.** metric 이 언제 몇 건이 어떤 상태 코드로 끝났는지를 알려 줬고,
trace 가 각 요청이 안에서 어느 경로를 탔는지를 알려 줬다. 빠진 것은 로그 하나다.

**그런데 다리가 끊겼다고 목적지에 못 가는 것은 아니었다.** 설계된 이동 경로는 로그의 trace_id 를
누르는 것인데, 로그가 없으니 그 길이 막혔다. 대신 Tempo 를 직접 검색해서 같은 곳에 도착했다.
다리는 편의이지 유일한 길이 아니다.

동시에 **빈 화면과 무의미한 화면을 구별하는 연습**이 됐다. Loki 가 비어 있었다면 수집이 끊긴 것을
의심해야 했지만, 6,300줄이 차 있는데 쓸 줄이 없었다. 앞의 No data 이야기와 같은 함정이다.

## 한계

**4xx 를 로그로 안 남기므로 인증 경로의 사건은 항상 metric 에서 끝난다.** 남기면 다리가 이어지지만,
모든 4xx 를 찍으면 봇 스캔까지 쌓인다. 남긴다면 인증 경로처럼 자리를 골라야 하고, 아직 안 골랐다.

**대시보드에 엔드포인트별 상태 코드 패널이 없다.** 그래서 이번 알림은 대시보드에서 시작할 수 없었고
곧바로 Explore 로 가야 했다. 같은 알림이 반복되면 패널로 만드는 편이 낫다.

**No data 를 구별해 주는 장치가 화면에 없다.** 건강해서 비었는지, 질의가 깨졌는지, 데모를 안 돌려서
비었는지를 사람이 옆 패널을 보고 판단하고 있다.

**로그의 trace_id 를 눌러 Tempo 로 건너간 기록은 아직 없다.** 이번에는 로그가 없어서 Tempo 를 직접
검색했고, [배송 실패 요청 하나를 trace와 Service Graph로 확인한 기록](/wiki/saga-trace-service-graph-verification)은
실패를 일부러 주입하고 따라간 것이라 어디를 볼지 이미 알고 있었다. 설계해 둔 다리 자체는 아직
실전에서 안 밟아 봤다.

**Tempo 보존이 24시간이다.** 이번에는 8시간 지난 뒤에 찾아서 남아 있었지만, 하루가 지나면 같은
방법이 안 통한다. 알림을 늦게 확인할수록 쓸 수 있는 신호가 줄어든다. 로그가 없는 경로일수록
이 24시간이 사실상의 조사 시한이 된다.

**JDBC 계측이 꺼져 있다.** 그래서 요청 하나의 348 ms 를 해싱과 DB 로 못 가른다. 지금은 다른 상태
코드의 소요 시간과 비교해서 추론하고 있는데, 계측을 켜면 span 하나로 끝날 일이다. 다만 켜면 모든
요청에 쿼리 span 이 붙어 저장량이 늘어난다. 보존이 이미 24시간으로 짧은 상황이라 같이 판단해야 한다.
