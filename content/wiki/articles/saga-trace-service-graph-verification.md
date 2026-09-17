
- 배송 실패 주문 하나의 보상 호출이 관측 신호에서도 같은 요청 흐름으로 묶이는지 어떻게 확인했나?
- span이 존재한다는 사실이 아니라, 결제 승인과 결제 취소 보상 호출이 같은 trace 안에 있는지를 확인 기준으로 삼았다.
- 2026-07-09 운영 공개 BFF에 배송 실패 요청을 보내 trace 315be5af02f691afa659df99ed129cb5 하나에 Spring과 FastAPI의 결제 승인·취소 span이 함께 묶인 것과, service graph metric의 jaywiki에서 jaywiki-payment-api 관계 생성을 확인했다.

관측 도구를 설치한 것과 요청 하나를 끝까지 추적할 수 있는 것은 다르다.

## 배송 단계에서 실패하는 주문을 만들었다

배송 단계에서 실패하도록 Saga 주문 요청을 만들었다. Spring orchestrator는 결제 취소와 재고 해제 보상을 실행하고,
최종 상태는 FAILED, 보상 단계는 PAYMENT_CANCELLED와 INVENTORY_RELEASED로 남아야 한다.

## 보상 호출까지 한 trace 안에 묶인 것을 확인했다

2026-07-09 운영 공개 BFF의 saga orders endpoint에 배송 실패 요청을 보내고 아래를 차례로 확인했다.

| 계층 | 확인한 내용 |
|---|---|
| 공개 API | 응답이 FAILED와 PAYMENT_CANCELLED, INVENTORY_RELEASED 보상 결과를 반환 |
| Tempo | trace 315be5af02f691afa659df99ed129cb5 하나에 Spring의 주문 handler, Spring RestClient 호출, FastAPI의 결제 승인과 결제 취소 span이 함께 묶임 |
| Loki | namespace backend 쿼리로 jaywiki와 jaywiki-payment-api 로그 수집 확인 |
| Prometheus | service graph metric에서 user에서 jaywiki, user에서 jaywiki-payment-api, jaywiki에서 jaywiki-payment-api 관계 확인 |
| Grafana | Prometheus, Loki, Tempo 데이터 소스와 로그의 trace id에서 Tempo로 넘어가는 연결 확인 |

여기서 중요한 것은 span이 존재한다는 사실이 아니라 **보상 호출까지 같은 trace 안에 있다**는 점이다.
결제 승인과 결제 취소가 서로 다른 trace로 흩어지면, 장애 조사 때 보상이 실제로 돌았는지 확인할 수 없다.

이 과정에서 Prometheus Helm Service가 80 포트를 9090으로 매핑한다는 점 때문에 Tempo의 remote write
주소에 9090을 붙이면 timeout이 났다. 포트를 빼고 나서야 service graph metric이 생성됐다.

## trace id 기록만으로는 부족하다

서비스 그래프 metric이 만들어지는지, public ingress를 user 노드로 해석하는지,
실패 시 보상 호출도 같은 흐름에서 찾을 수 있는지까지 봐야 관측 구성이 실제 운영에 쓸 수 있다.

## 범위 — 실패 주입이 가능한 교육용 시나리오다

이 검증은 실패 주입이 가능한 교육용 주문 시나리오를 기준으로 한다. 실제 결제망이나 다중 리전 분산 트랜잭션을
구현했다고 주장하지 않으며, Saga의 책임과 보상 흐름을 관측 가능하게 만든 기록이다.
