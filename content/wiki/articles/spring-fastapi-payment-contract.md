
- 결제 참여자를 왜 별도 FastAPI 서비스로 뗐고, Spring과 어떤 실패 계약을 맺었나?
- Saga의 실패와 보상을 실제 서비스 경계에서 보이도록 결제를 FastAPI로 분리하고, 연결 불가와 timeout은 비즈니스 충돌 409가 아니라 인프라 장애 503으로 구분해 돌려주기로 판단했다.
- 응답하지 않는 가짜 결제 서버로 timeout을 재현해 connect 2초·read 5초 설정대로 약 5초 뒤 503이 반환되는 것을 확인했다.

위키와 게시판만 보면 결제 서비스가 필요하지 않다. Saga와 서비스 간 실패 처리를 설명하려고 주문 시나리오를
따로 만들고, Spring과 FastAPI가 서로 다른 책임을 갖게 했다.

## Spring이 순서를, FastAPI가 원본을 쥔다

| 구성요소 | 책임 |
|---|---|
| Spring Boot | 주문 상태, 단계 진행, 보상 순서, 그리고 두 참여자가 낸 사실의 사본 |
| FastAPI payment-api | 결제 승인과 결제 취소 API, 결제의 원본과 아웃박스 |
| FastAPI shipping-api | 배송 접수 API, 배송의 원본과 아웃박스 |
| PostgreSQL | portfolio 에 Saga 단계와 결과, pg-services 에 결제·배송의 원본 |
| Tempo | Spring과 FastAPI 호출을 같은 요청 trace로 연결 |

## 계약 — 결제 승인과 취소를 HTTP로 부른다

Spring은 결제 승인과 취소를 HTTP로 호출한다.

| 요청 | 성공 | 실패 시 Spring의 처리 |
|---|---|---|
| 결제 승인 | payment id와 승인 상태 | Saga 실패로 기록하고 필요한 보상 단계 진행 |
| 결제 취소 | payment id와 취소 상태 | 배송 실패 뒤 결제 보상 완료로 기록 |

배송 실패 시나리오에서는 결제 승인을 마친 뒤 배송 단계에서 실패를 주입한다. 실패를 판정하는 것은
shipping-api 다 — 요청에 fail 을 실어 보내면 409 를 돌려준다. Spring은 그걸 받고 payment-api에
취소를 요청한 뒤, 재고 해제와 주문 실패를 순서대로 기록한다.

## 느린 의존도 실패다

외부 호출은 연결 거부만 실패가 아니다. 응답하지 않는 서비스도 요청 스레드를 묶는다. 그래서 payment client는
connect 2초, read 5초 timeout을 둔다. 결제 서비스에 연결할 수 없거나 읽기 시간이 넘으면 비즈니스 충돌인
409가 아니라 인프라 장애인 503 problem response를 돌려준다.

이 구분이 있어야 사용자는 결제가 거절된 것과 결제 서비스를 사용할 수 없는 것을 다르게 이해하고,
운영자는 503을 관측과 알림의 대상으로 다룰 수 있다.

## timeout 재현으로 503 반환까지 확인했다

응답하지 않는 가짜 결제 서버로 timeout을 재현해 약 5초 뒤 503이 반환되는 것을 확인했다.
다음 운영 기록에서는 실제 Saga 실패 요청의 trace id, payment authorize와 cancel span, 보상 metric을
같은 사건으로 연결한다.
