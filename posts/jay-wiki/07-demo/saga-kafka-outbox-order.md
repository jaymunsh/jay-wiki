---
title: "Saga, Outbox, Kafka를 주문 시나리오로 분리한 이유"
slug: saga-kafka-outbox-order
tab: "시나리오·시연"
parentId: demo
sortOrder: 0
kind: wiki
tags: saga,kafka,outbox,order
source: scripts/seed-portfolio-wiki.mjs
---
- Saga·Outbox·Kafka를 왜 위키 도메인이 아니라 별도 주문 시나리오로 만들었고, 만들면서 무엇이 드러났나?
- 위키 수정 이벤트에 억지로 붙이지 않고 쇼핑몰 주문 시나리오를 분리했고, 결제 거절(비즈니스 실패)과 결제 서비스 장애(인프라 실패)를 다른 응답 코드로 구분하기로 했다.
- 결제 RestClient에 타임아웃이 없어 payment-api가 느려지면 보상 코드에 도달하지 못하는 문제를 찾아 connect 2초, read 5초로 끊게 고쳤고, Saga 화면에서 배송 실패를 주입하면 결제 취소와 재고 해제가 보상으로 기록된다.

위키 서비스 자체에는 Saga와 Kafka가 꼭 필요하지 않다. 그래서 억지로 위키 수정 이벤트에
붙이지 않고, 분산 시스템 패턴을 설명하기 쉬운 쇼핑몰 주문 시나리오를 별도로 만들었다.

## 세 기술은 각자 다른 질문에 답한다

| 기술 | 해결하는 질문 | jay-wiki 시연 |
|---|---|---|
| Saga | 여러 단계 중 실패하면 어떻게 보상할까 | Spring orchestrator + FastAPI payment |
| Outbox | DB 저장 후 이벤트 발행 실패를 어떻게 줄일까 | tb_outbox_event에 발행 예정 이벤트 기록 |
| Kafka | 후속 작업을 어떻게 독립 처리할까 | consumer fan-out, retry, DLQ |

## 전체 그림 — Saga 쪽 outbox에는 relay가 없다

~~~mermaid
flowchart TD
    SagaOrder[Saga 주문] --> Saga[Saga 결제/배송/보상]
    SagaOrder --> OutboxSaga[(Outbox ORDER_SAGA - 기록만)]
    DemoOrder[Kafka 시연 주문] --> OutboxDemo[(Outbox KAFKA_DEMO_ORDER)]
    OutboxDemo --> Relay[Relay]
    Relay --> Kafka[(Kafka topic)]
    Kafka --> Inventory[Inventory consumer]
    Kafka --> Notification[Notification consumer]
    Kafka --> Analytics[Analytics consumer]
    Notification --> DLQ[(DLQ)]
~~~

그림에서 ORDER_SAGA 쪽 outbox에 relay 화살표가 없는 것은 실수가 아니다. relay의 폴링 쿼리는
aggregate_type이 KAFKA_DEMO_ORDER인 행만 읽는다. 그래서 Saga 주문의 outbox 행은 기록만 되고
발행되지 않는다 — 로컬의 ORDER_SAGA 33건이 전부 NEW로 남아 있다. 쓰기는 구현했고 읽어 가는
쪽이 없는 미완이며, [전체 DB 스키마를 도메인별 ERD로 읽기](/wiki/db-schema-erd-map)의
미완 목록에도 같은 사실이 있다.

## 왜 나눴나

처음부터 모든 것을 Kafka choreography로 만들면 설명이 어려워진다. 그래서 Saga 화면은
업무 보상 흐름을, Kafka 화면은 이벤트 fan-out과 실패 격리를 보여주도록 나눴다.

## 보상과 DLQ 이동을 화면에서 직접 본다

- Saga 화면에서 배송 실패를 주입하면 결제 취소와 재고 해제가 보상으로 기록된다.
- Kafka 화면에서 알림 consumer를 실패시켜 retry와 DLQ 이동을 볼 수 있다.
- Grafana에는 RED와 Kafka 시연 대시보드 둘이 있고 DLQ 흐름은 Kafka 시연 대시보드에서 본다. Saga 지표는 Prometheus에 노출은 되지만 아직 전용 대시보드가 없다.

## 보상 로직보다 timeout이 먼저였다

Saga 를 만들 때는 실패를 어떻게 되돌릴지에 집중하게 된다.
그런데 정작 결제 서비스를 부르는 RestClient 에는 타임아웃이 없었다.

payment-api 가 죽으면 연결 오류가 나므로 보상 경로가 잘 돈다.
문제는 payment-api 가 **죽지 않고 그냥 느려질 때**다.
그때는 Spring 의 요청 스레드가 응답을 무한히 기다린다.
보상 트랜잭션은 코드에 있지만 거기까지 도달하지 못한다.

지금은 connect 2초, read 5초로 끊는다.

## 실패의 종류를 응답 코드로 구분한다

이 시나리오를 만들면서 결제 실패가 한 종류가 아니라는 것이 드러났다. **결제가 거절된 것**은 비즈니스
실패라 Saga 가 보상하고 주문을 FAILED 로 끝내면 된다. **결제 서비스에 닿지 못한 것**은 인프라 실패라
보상할 대상 자체가 없어 운영자 개입으로 넘긴다. 화면에서도 두 경우가 다른 결과로 보이게 응답 코드를 갈랐다.

전에는 두 번째도 409 Conflict 로 나갔다.
전역 예외 처리기가 IllegalStateException 을 전부 409 로 바꾸고 있었고,
결제 클라이언트는 서비스 장애를 IllegalStateException 으로 던졌기 때문이다.

운영자 입장에서 409 는 "요청이 현재 상태와 충돌했다"는 뜻이다.
결제 서비스가 내려간 상황을 그렇게 말하면 잘못된 곳을 보게 된다.

**교훈**: 예외를 상태 코드로 옮길 때는 예외의 클래스가 아니라 **실패의 성격**을 봐야 한다.
편의를 위해 예외 하나에 여러 의미를 담으면, 그 편의는 응답 코드에서 비용으로 돌아온다.

두 서비스의 계약과 timeout 값은 [Spring과 FastAPI를 Saga 경계로 나눈 이유](/wiki/spring-fastapi-payment-contract)에,
전체 오류 응답 기준은 [장애를 HTTP 응답으로 숨기지 않는 기준](/wiki/api-error-contract)에 정리했다.
