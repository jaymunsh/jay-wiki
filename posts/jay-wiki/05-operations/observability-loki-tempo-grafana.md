---
title: "Metrics·Logs·Traces를 연결한 관측 경계"
slug: observability-loki-tempo-grafana
tab: "운영·관측"
parentId: operations
sortOrder: 0
kind: wiki
tags: loki,tempo,grafana,observability
source: scripts/seed-portfolio-wiki.mjs
---
- Metrics·Logs·Traces·Alert가 각각 어떤 경로로 모이고, 요청 하나를 어떤 순서로 따라가나?
- trace만 OTel Collector를 거치게 해 앱이 저장소 주소를 모르게 했고, 공개 사이트에는 서버가 미리 정한 PromQL의 집계 결과만 내려보내 브라우저가 PromQL을 보내지 못하게 했다.
- Telegram 테스트 알림과 backend down 발생·복구 알림을 실제로 받았고, traces_service_graph_request_total에 client jaywiki, server jaywiki-payment-api 조합이 생성되는 것을 확인했다.

관측 스택의 목적은 설치 자체가 아니다.

운영자가 문제를 만났을 때 요청 하나를 따라갈 수 있어야 한다.

## 현재 구성 — 세 신호의 수집 경로가 서로 다르다

세 신호는 같은 화면에서 만나지만, 수집 경로는 서로 다르다. 이 차이를 모르면 어느 한 축이 비었을 때
무엇을 고쳐야 하는지 알 수 없다.

| 축 | 도구 | 수집 경로 | 답하는 질문 |
|---|---|---|---|
| Metrics | Prometheus | Spring Actuator·FastAPI metrics와 cluster exporter를 직접 scrape | 지금 전체 실패율이나 지연이 높은가 |
| Logs | Loki | 각 노드의 Promtail이 컨테이너 로그를 Loki로 push | 어떤 에러 메시지가 남았는가 |
| Traces | Tempo | 앱이 OTLP로 OTel Collector에 보내고 Collector가 Tempo로 전달 | 요청 하나가 어떤 서비스를 거쳤는가 |
| Alert | Alertmanager | Prometheus 규칙이 발화하면 Telegram으로 발송 | 내가 보고 있지 않을 때 무엇이 깨졌는가 |
| Dashboard | Grafana | Prometheus·Loki·Tempo를 datasource로 연결 | 세 신호를 한 화면에서 교차 확인한다 |

trace만 Collector를 거치는 이유는 앱이 어느 backend로 보내는지 모르게 하기 위해서다. Spring과 FastAPI는
OTEL_EXPORTER_OTLP_ENDPOINT로 Collector 주소만 알고, Tempo 주소는 Collector의 exporter 설정에만 있다.
저장소를 바꿔도 애플리케이션 배포를 건드리지 않는다.

## 신호가 비면 끊어진 구간부터 좁힌다

Grafana에 값이 없다는 사실만으로 애플리케이션 장애라고 결론 내릴 수는 없다. 신호마다 수집 주체가 다르므로
먼저 끊어진 구간을 좁힌다.

| 비어 있는 신호 | 먼저 확인할 곳 | 다음 판단 |
|---|---|---|
| Metrics | Prometheus target의 up 상태와 scrape 오류 | 앱 endpoint 장애인지 Prometheus 수집 장애인지 구분 |
| Logs | 노드의 Promtail 상태와 Loki push 오류 | 로그 미출력인지 전달 실패인지 구분 |
| Traces | 앱의 OTLP endpoint와 Collector traces pipeline | 계측 누락인지 Collector·Tempo 전달 실패인지 구분 |
| Service Graph | Tempo metrics-generator와 Prometheus remote write | trace는 있는데 관계 metric만 없는 상황을 분리 |

이 순서는 Grafana를 원인으로 단정하지 않고 producer, collector, storage, visualization을 차례로 나누기 위한
운영 기준이다.

## 시연에는 Saga 배송 실패 요청이 가장 좋다

Saga 배송 실패 시나리오가 가장 좋다.

Spring이 주문을 받고, FastAPI payment-api에 결제 승인을 요청한 뒤, 배송 실패를 만나 결제 취소와 재고 해제를 수행한다.

~~~mermaid
sequenceDiagram
    participant UI
    participant Spring
    participant FastAPI
    participant Collector as OTel Collector
    participant Tempo
    UI->>Spring: 배송 실패 주문 실행
    Spring->>FastAPI: 결제 승인
    Spring->>Spring: 배송 실패
    Spring->>FastAPI: 결제 취소 보상
    Spring->>Collector: OTLP span 전송
    FastAPI->>Collector: OTLP span 전송
    Collector->>Tempo: 같은 trace로 묶어 저장
~~~

## 세 신호를 한 요청에서 교차 확인한다

- Prometheus에서 실패 수와 latency를 본다.
- Loki에서 backend namespace 로그가 수집되는지 본다.
- trace_id가 있는 로그는 Tempo로 이동할 수 있다.
- Tempo에서 jaywiki와 jaywiki-payment-api span이 같은 trace에 묶이는지 본다.
- Service Graph metric으로 서비스 간 호출 관계를 본다.

## 누가 무엇까지 볼 수 있는가

관측 데이터는 운영 정보다. 어떤 job이 있고 어떤 label이 붙어 있으며 어떤 로그가 남는지는 공격자에게도
유용한 정보라, 공개 사이트와 운영자 화면의 경계를 나눴다.

| 대상 | 접근 조건 | 볼 수 있는 것 |
|---|---|---|
| 공개 사이트의 운영 패널 | 없음 | 서버가 미리 정한 PromQL의 집계 결과만. 요청률, 5xx 비율, p95, Kafka 소비·DLQ, Pod·노드 자원 |
| Grafana | Cloudflare Access + Grafana 로그인 | raw metric, label, 로그 원문, trace, 대시보드 전체 |

핵심은 **브라우저가 PromQL을 보내지 못한다**는 것이다. 질의문은 서버 코드에 상수로 있고, 공개 API는
그 결과 숫자만 내려보낸다. 원본 로그나 trace를 iframe으로 공개 화면에 끼워 넣지도 않는다.

## 관측은 알림까지다

화면을 보고 있을 때만 발견되는 장애는 절반만 관측된 것이다. Prometheus 규칙이 발화하면
Alertmanager가 Telegram으로 보내도록 구성했고, 테스트 알림 수신과 backend down 발생·복구 알림을
실제로 확인했다. Service Graph도 Tempo의 metrics-generator로 켜서
traces_service_graph_request_total의 client jaywiki, server jaywiki-payment-api 조합이 생성되는 것을 확인했다.

즉 이 프로젝트는 단순 CRUD가 아니라, 요청 하나를 추적하고 깨졌을 때 사람에게 도달하는 경로까지 포함한다.

## 실패 요청 하나를 실제로 따라간 기록은 따로 남겼다

특정 실패 요청 하나를 골라 trace id 를 적고 Tempo span, Loki 로그와 service graph metric 을 차례로
확인한 결과는 [배송 실패 요청 하나를 trace와 Service Graph로 확인한 기록](/wiki/saga-trace-service-graph-verification)에 있다.
관측 스택이 설치돼 있다는 사실과, 그것으로 실제 문제를 찾아본 기록은 다르기 때문에 별도 글로 남겼다.

아직 남은 것은 **장애를 미리 알지 못한 상태에서** 같은 경로를 쓰는 일이다. 지금 기록은 실패를 의도적으로
주입하고 그 요청을 찾아간 것이라, 어디를 봐야 하는지 이미 알고 있었다. 원인을 모르는 알림 하나에서
출발해 metric, log, trace 순으로 좁혀 간 기록이 생겨야 이 스택이 실전에서 쓸 만하다고 말할 수 있다.
