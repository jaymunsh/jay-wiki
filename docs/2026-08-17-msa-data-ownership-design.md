# MSA 데이터 분리 — 데이터 소유권을 두 겹으로 강제한다

이 프로젝트는 MSA 가 아니다. **모듈러 모놀리스 + Saga 참여자 하나**다.

MSA 요건 대부분은 이미 있다. 없는 것은 하나고, 그 하나가 나머지를 전부 무의미하게 만든다.

| MSA 요건 | 지금 | |
|---|---|---|
| 프로세스 분리 | `services/payment-api` 별도 컨테이너 | 있다 |
| 독립 배포 | 이미지 4개가 따로 빌드·배포 | 있다 |
| 비동기 통신 | Kafka + `OutboxEventService` (트랜잭셔널 아웃박스) | **있지만 논다** |
| 분산 트랜잭션 | Saga 오케스트레이션 + 보상 + `failAt` 주입 | 있다 |
| 분산 추적 | 두 프로세스 다 OTel → Tempo | 있다 |
| **데이터 소유권** | 모놀리스 DB 가 `SagaPayment` 를 들고, payment-api 는 메모리 dict | **없다** |

이 문서는 그 하나를 채우는 설계다.

## 실측 — 지금 무엇이 있나

숫자는 전부 2026-08-17 에 운영에서 직접 잰 값이다.

| | 값 | 출처 |
|---|---|---|
| `tb_saga_payment` | **65행** | 운영 psql |
| `tb_saga_shipping` | **2행** | 운영 psql |
| `tb_saga_order` | **66행** | 운영 psql |
| `payment-api` 크기 | **161줄**, 라우트 4개 | `services/payment-api/src/payment_api/main.py` |
| `payment-api` 의존성 | DB 없음, Kafka 없음 | `pyproject.toml` |
| miniPC 여유 메모리 | **10Gi** / 15Gi, CPU 4% | `free -h`, `kubectl top nodes` |
| NetworkPolicy API | `networking.k8s.io/v1` **있음** | `kubectl api-resources` |

### 확인 과정에서 드러난 것 셋

앞선 인계 문서(`.claude/session/handoff-20260817-0230.md`)가 사실과 어긋난 곳이다.

**1. `partner-simulator` 는 사가와 무관하다.** 호출자가 전부 `domainlab` 패키지(파트너 API
회복탄력성 리허설)고, 사가 코드 어디서도 안 부른다. 그러니 지금 사가 흐름의 서비스는
셋이 아니라 **모놀리스 + payment-api 둘**이다. "셋"이라고 세던 것이 실은 둘이었다.

**2. Kafka 는 프로세스를 안 건넌다.** `OrderSagaSteps` 는 사가가 **끝났을 때만** 아웃박스에
쓰고(`:144` COMPLETED, `:216` FAILED), `KafkaDemoOutboxRelay` 가 2초마다 발행하고,
`KafkaDemoConsumers` 가 받는다. 즉 **모놀리스 → 모놀리스**다. 게다가
`@ConditionalOnProperty(app.kafka-demo.enabled)` 라 꺼져 있으면 아예 안 뜬다.
릴레이 자체는 잘 짜여 있다 — `for update skip locked` 선점, 외부 호출을 트랜잭션 밖으로.
**놀고 있는 것은 구현이 아니라 배치다.**

**3. `shipping` 은 자를 로직이 없다.** `requestShipping()`(`OrderSagaSteps.java:197-203`)은
외부 호출이 하나도 없다. row 하나 만들고 `REQUESTED` 를 박는 게 전부다.
**가장 싸게 두 번째 사례를 얻을 수 있다는 뜻이다.**

## 분리 지점

`SagaPayment` 를 쓰는 코드는 셋뿐이다.

- `OrderSagaSteps.java:92` — 결제 승인 후 상태 저장
- `OrderSagaSteps.java:251` — 주문 화면 그릴 때 결제 상태 조회
- `SagaPaymentRepository.java`

**251번 줄 하나가 이 설계의 전부다.** 지금은 `paymentRepo.findByOrderId(...)` — 같은 트랜잭션,
같은 DB, 항상 최신. 자르면 이게 프로세스 경계를 넘고 그 순간 넷이 따라온다.

1. 느려지고 실패할 수 있다 → 타임아웃·재시도·폴백
2. 최신이 아닐 수 있다 → 결과적 일관성이 **화면에 드러난다**
3. 조회를 조합할 곳이 필요하다 → 매번 물을지, 사본을 둘지
4. 되돌리기가 코드가 아니라 대화가 된다

## 결정 1 — 경로별로 방식을 나눈다

동기 조회와 이벤트 사본 중 하나를 고르는 문제가 아니다. **경로가 둘이고 요구가 다르다.**

| 경로 | 방식 | 왜 |
|---|---|---|
| 쓰기 (Saga 승인) | 동기 HTTP — **이미 그렇다** | 승인은 즉답이 있어야 다음 단계를 간다 |
| 읽기 (주문 화면 `view()`) | **Kafka 이벤트 사본** | 화면은 결제가 죽어도 떠야 한다 |

이 분리가 장애 격리 실증을 성립시킨다. payment-api 를 `replicas: 0` 으로 내리면 —
**새 주문은 승인에서 실패해 보상까지 가고, 기존 주문 화면은 멀쩡히 뜬다.**
동기 조회로 통일했으면 둘 다 죽는다.

**여기서 Kafka 가 처음으로 의미를 가진다.** 분리 후엔 두 서비스가 각자 아웃박스를 통해
사실을 내보내고 모놀리스가 받는다. 같은 패턴이 세 프로세스에 있고 방향만 다르다.

### 분리하면 사가 흐름 자체가 바뀐다

`OrderSagaFailAt` 에는 이미 실패 주입 넷이 있다(`NONE`, `INVENTORY_RESERVE`, `PAYMENT_AUTHORIZE`,
`SHIPPING_REQUEST`). 이 중 **`SHIPPING_REQUEST` 의 성격이 바뀐다.**

| 단계 | 지금 | 분리 후 |
|---|---|---|
| `INVENTORY_RESERVE` | 로컬 DB | 그대로 (재고는 모놀리스 소유) |
| `PAYMENT_AUTHORIZE` | 원격 HTTP | 그대로 |
| `SHIPPING_REQUEST` | **로컬 코드** — row 하나 삽입 | **원격 HTTP** — 타임아웃·재시도·보상이 payment 와 같아진다 |

`compensateAfterShippingFailure`(`OrderSagaSteps.java:118`)는 지금 로컬 실패만 다룬다.
분리 후엔 **응답이 안 오는 경우**(타임아웃)가 생기고, 그건 실패와 다르다 — 배송이 접수됐는지
모르는 상태다. 여기서 보상은 결제 취소로 이어진다.

**보상 경로는 이미 있다.** payment-api 의 `/payments/{payment_id}/cancel`(`main.py:156`)이 그것이고,
분리 후엔 이 취소도 **자기 DB 에 쓰고 이벤트를 내야 한다.** 취소가 프로젝션에 안 반영되면
화면은 취소된 결제를 `AUTHORIZED` 로 계속 보여준다. 아웃박스가 승인 경로에만 붙으면 조용히 틀린다.

## 결정 2 — DB 는 논리 분리가 아니라 인스턴스 분리다

**실무 다수는 단일 DB + 스키마 분리다.** DB 인스턴스를 나누면 백업·모니터링·버전 업그레이드가
전부 N배가 되니, 그 비용을 감당할 이유가 생기기 전엔 안 나눈다. 이 판단은 옳다.

그리고 흔히 드는 반대 근거 하나는 **이 환경에서 성립하지 않는다.** miniPC 는 노드가 하나라
postgres 를 셋으로 띄워도 같은 커널, 같은 디스크, 같은 전원이다. "다른 노드로 옮길 수 있다"는
이점은 **지금 실현되지 않는다.** 이걸 근거로 쓰지 않는다.

그런데도 인스턴스를 나누는 이유는 하나뿐이고, 그 하나가 결정적이다.

**NetworkPolicy 는 DB 가 별도 pod 일 때만 걸린다.** 정책의 `podSelector` 는 **파드 라벨**을 본다.
모놀리스와 서비스가 같은 postgres pod 에 붙으면 네트워크 층에서 구분할 대상이 없다.
스키마 분리를 택하면 소유권 강제가
**계정 권한 한 겹으로 줄고, 보여줄 증거가 "그렇게 안 썼습니다" 뿐이 된다.**

### 그런데 신규 인스턴스는 둘이 아니라 하나다

처음에는 `pg-payment` 와 `pg-shipping` 을 따로 띄우려 했다. 다시 따져 보니
**둘을 나눠서 얻는 것이 한 칸뿐이다.**

| 누가 → 어디로 | 인스턴스 둘 | `pg-services` 하나 |
|---|---|---|
| 모놀리스 → 결제·배송 DB | 네트워크 차단 | **네트워크 차단** (그대로) |
| payment-api → 배송 데이터 | 네트워크 차단 | 계정 권한만 |
| shipping-api → 결제 데이터 | 네트워크 차단 | 계정 권한만 |

**이 설계의 주제인 「모놀리스가 결제 데이터를 직접 읽으면 안 된다」는 하나로 묶어도 그대로 선다.**
빠지는 것은 payment ↔ shipping 사이 한 칸이고, 그 둘은 서로 조인할 일이 없다.
그 한 칸 값으로 pod 하나와 백업 대상 하나가 는다 — 백업은 이 설계가 꼽은 리스크 자리다.

되돌리는 방향도 이쪽이 맞다. `pg-services` → 인스턴스 둘은 나중에 쉽다
(`pg_dump` 하나와 커넥션 문자열. 둘이 조인하지 않으니 엉킬 것이 없다).
반대로 스키마 분리 → 인스턴스는 어렵다 — 그때는 이미 서비스들이 같은 커넥션으로 조인하고 있다.
**모놀리스와는 인스턴스를 나누고, 서비스끼리는 나중으로 미룬다.**

| 프로세스 | DB | 소유하는 것 |
|---|---|---|
| 모놀리스 (Spring) | `portfolio` | `tb_saga_instance`, `tb_saga_order`, `tb_saga_inventory`, `tb_saga_step` + **프로젝션 2개** |
| payment-api (FastAPI) | **`pg-services` 신규 인스턴스**의 `payment` DB | `tb_payment`, `tb_payment_outbox` |
| shipping-api (FastAPI, 신설) | 같은 `pg-services` 의 `shipping` DB | `tb_shipping`, `tb_shipping_outbox` |
| partner-simulator | 없음 | domainlab 전용. 이번 범위 밖 |

서비스끼리는 계정으로 가른다 — `payment_svc` 는 `shipping` DB 에 `CONNECT` 가 없고, 반대도 같다.

**`tb_saga_payment` 와 `tb_saga_shipping` 은 지운다.** 모놀리스가 대신 드는 것은 둘뿐이다.

- `tb_saga_order.payment_id` / `.shipping_id` — 사가가 가리키는 **참조**. 상태는 안 든다
- `tb_payment_projection` / `tb_shipping_projection` — 이벤트로 받아 쓰는 **읽기 전용 사본**

**이름이 설계의 일부다.** `tb_payment_projection` 은 "결제의 상태"가 아니라
**"우리가 마지막으로 들은 결제의 상태"** 다. 이 이름이 결과적 일관성을 코드에서 계속 상기시킨다.
컬럼은 `payment_id`, `order_id`, `status`, `occurred_at`(원본 시각), `observed_at`(수신 시각).
두 시각을 다 드는 이유는 결정 4 에 있다.

## 결정 3 — 소유권을 두 겹으로 강제한다

분리가 문서상의 약속으로 남지 않게 하는 것이 이 설계에서 가장 중요한 부분이다.

| 층 | 수단 | 위반하면 |
|---|---|---|
| 애플리케이션 | `payment_svc` 는 `pg-services` 의 `payment` DB 에만 붙는다. `portfolio` 와 `shipping` 에는 `CONNECT` 를 안 준다 | 붙어도 **권한이 없다** |
| 네트워크 | NetworkPolicy — `pg-services` 는 `payment-api`·`shipping-api` 파드에서 오는 것만 받는다 | 모놀리스는 **애초에 패킷이 안 닿는다** |

지금 클러스터는 DB 가 `ClusterIP` 라 외부엔 안 열려 있지만, **네임스페이스 안에서는 아무 파드나
붙을 수 있다.** 모놀리스가 `pg-services` 에 TCP 로 접근하는 걸 막는 것이 현재는 아무것도 없다.

| 대상 | 허용 | 나머지 |
|---|---|---|
| `pg-services` | `payment-api`·`shipping-api` 파드 | 거부 (모놀리스 포함) |
| `payment-api` / `shipping-api` | 모놀리스, Prometheus | 거부 |

**실증이 쉽다.** 모놀리스 파드에서 `pg-services` 로 `nc -z -w3` 를 때려 타임아웃 나는 화면 한 장이면
증명이 끝난다. 첫 화면 지도(`OrchestrationBoard`)에 그 결과를 넣는다.

전제: k3s 는 flannel 에 kube-router 기반 정책 컨트롤러를 내장한다
(`--disable-network-policy` 로 끄지 않는 한). API 존재는 확인했고, **실제 차단은 배포 후 검증한다.**
안 되면 계정 분리 한 겹으로 물러선다. 나머지 설계는 그대로 선다.

## 결정 4 — 결과적 일관성을 숨기지 않는다

프로젝션이 아직 안 온 순간, 화면은 **「확인 중 (1.2초 전 기준)」** 으로 표시한다.
폴링으로 매끄럽게 감추지 않는다.

이 프로젝트의 요지가 바로 이것이기 때문이다. 감추면 분리한 것과 안 한 것이 화면에서 구분되지
않고, 그러면 분리할 이유가 없어진다. `observed_at` 을 프로젝션에 두는 이유가 이 표시다.

## 결정 5 — gateway 는 추가가 아니라 대체다

현재 요청 경로는 이미 입구가 둘이다.

```
브라우저 → traefik(ingress) → Next.js → BFF 라우트(77줄) → Spring
```

여기에 Spring Cloud Gateway 를 **추가**하면 5홉이고, 그건 어거지다. **BFF 를 대체하면 다르다.**

```
브라우저 → traefik → Spring Cloud Gateway → Spring / payment-api / shipping-api
```

홉 수는 그대로고 `web/src/app/api/bff/[...path]/route.ts` 77줄은 실제로 사라진다.

### BFF 는 놀지 않았다 — 게이트웨이 일을 하고 있었다

| `route.ts` | 하는 일 | gateway 에서 |
|---|---|---|
| `:12` | 백엔드 주소 은폐 | 라우팅 정의 |
| `:18-19` | 인증 쿠키(`jw_token`) 전달 | 기본 동작 |
| `:20-23` | `cf-connecting-ip`·`x-forwarded-for` 보존 | `PreserveHostHeader` + 필터 |
| `:35-46` | 백엔드 다운 시 `problem+json` 502 | `CircuitBreaker` + fallbackUri |
| `:52-55` | `x-cache`·`x-search-engine` 통과 | 기본 동작 |
| `:57-59` | `Set-Cookie` 되돌리기 | 기본 동작. **여기가 리스크** |

정확한 표현은 "BFF 가 뭘 했나"가 아니라 **"게이트웨이의 일을 Next 가 대신하고 있었다"** 다.
새 계층을 얹는 게 아니라 **역할을 제자리로 옮기는 것**이고, 서비스가 넷이 되면서 비로소 정당해진다.

### 대체로 잃는 것

- **공격면이 는다.** 지금 외부 노출은 Next 하나고 Spring 은 완전 내부다. 대체하면
  gateway 가 밖으로 나온다
- **CORS 가 생길 수 있다.** 지금은 같은 오리진이라 preflight 가 없다.
  traefik 에서 **같은 호스트의 `/api/*` 만** gateway 로 보내 피한다. ingress 규칙이 는다
- **SSR 은 여전히 `BACKEND_BASE` 로 직접 부른다.** 서버-서버라 gateway 를 안 지나는 게 맞다.
  **gateway 가 Next 를 대체하는 게 아니다**

**TOTP 는 그대로 통과시킨다.** gateway 는 쿠키·헤더를 전달만 하고 검증은 Spring 에 남긴다.
인증 필터를 gateway 로 올리는 쪽이 MSA 답지만, 로그인이 깨질 위험이 가장 크고 얻는 게 적다.
payment-api·shipping-api 는 모놀리스만 부르므로 서비스마다 인증을 다시 검증할 일이 없다.

## 결정 6 — 구매자를 넣는다. 인증은 안 넣는다

지금 `SagaOrder` 에는 구매자가 없다 — `productCode`, `quantity`, `status`, `idempotencyKey` 뿐이다.
시연하면 "누가 샀는지"가 화면에 없어서 사가가 추상적으로만 읽힌다.

**그런데 시연보다 큰 값이 따로 있다.** 지금 설계에는 데이터 소유권을 나눴을 때 실제로 겪는
불편의 사례가 **결제 상태 하나뿐**이고, 그것만으로는 "API 호출 하나 더" 로 보인다.

분리 후 payment-api 는 `customer_id` **참조만** 든다. 이름은 모놀리스에 있다.
결제 화면에 "누구의 결제"를 띄우려면 **조인이 안 된다** — DB 가 다르다.
모놀리스가 자기 쪽에서 이름을 붙여 조립해야 한다.
**같은 사람을 서비스마다 다르게 안다** — 이게 소유권 분리의 대표적 대가고, 지금 설계에 빠져 있다.

**자리는 `portfolio` 다. `pg-services` 가 아니다.** 구매자는 주문 도메인 데이터고,
사가를 시작하는 모놀리스가 알아야 주문을 만든다. `pg-services` 에 두면
**모놀리스가 남의 DB 를 읽어야 하는 상황**이 새로 생긴다 — 지금 지우고 있는 그 문제를 다시 만든다.

**분리 *전*에 넣는다.** 분리 후에 넣으면 "고객 이름이 payment 응답에서 사라졌다"는 대비가 안 생긴다.

| | |
|---|---|
| 테이블 | `portfolio.tb_saga_customer` — `id`, `name`, `email`(가짜), `grade` |
| 데이터 | 데모 고객 대여섯 명 시드. **가입·로그인·인증 없음** |
| 주문 | `tb_saga_order.customer_id` 추가. 주문 요청에서 고객을 고른다(드롭다운) |
| 분리 후 | payment·shipping 은 `customer_id` 만 든다. 이름은 안 복제한다 |
| 비용 | pod 0개, 서비스 0개, 새 이미지 0개 |

**user 서비스로 빼지 않는다.** 인증이 이미 Spring 에 있어(TOTP, `jw_token`) 빼내면
로그인이 깨질 위험이 이 계획에서 가장 큰데 얻는 게 가장 적다. 결정 5 에서 TOTP 를
Spring 에 남기기로 한 것과 같은 근거다.

## 하지 않는 것

| | 왜 |
|---|---|
| 회원가입·로그인 도메인 | 구매자는 시드한 데모 데이터다. 인증은 이미 Spring 에 있고 건드릴 이유가 없다 |
| user-api 서비스 | 세 번째 서비스는 payment·shipping 과 같은 패턴의 복제다. 새로 보여줄 것이 없다 |
| Eureka | 서비스가 넷이고 주소가 고정이면 k8s Service 가 이미 하는 일이다 |
| Config Server | 설정이 `application-prod.yml` + env 로 끝난다. 갱신 주기가 배포 주기와 같다 |
| 서비스 메시 | 사이드카가 파드마다 붙는다. 지금 트래픽에서 관측은 OTel 이 이미 한다 |
| 서비스를 다섯 이상으로 | 넷째부터는 "왜 넣었나"에 답이 없다 |
| shipping-api 를 다른 언어로 | 다양성은 어필이 아니라 유지비다. FastAPI 로 복제한다 |
| Schema Registry | 이벤트 스키마 둘, 소비자 하나. JSON 으로 충분하다 |
| polyglot persistence (Mongo·Redis 등) | 배송은 상태 전이 하나라 문서 DB 이점이 없다. **결제 멱등성 키를 Redis 로 옮기면 유실 시 이중 결제**라 postgres 유니크 제약이 맞다. 클러스터엔 이미 postgres·Redis·OpenSearch·MinIO·Kafka 가 떠 있어 종류는 충분하다 |
| alembic | 테이블이 서비스당 둘이다. 생짜 SQL + init 스크립트 |
| 기존 65행 이관 | 데모 데이터다. 과거 주문은 `NONE` 으로 뜨고 새 사가부터 새 구조를 탄다 |

## 착수 전 코드 대조에서 나온 여섯 (2026-08-17)

설계를 실제 파일에 대조하며 나온 것들이다. 치명적 결함은 없었고, 문서가 안 다루던 부분이다.

### 1. 보상 직후 화면이 틀린다 — 결정 4 를 보상 경로에도 건다

지금 `OrderSagaSteps.java:130` 이 보상할 때 모놀리스 DB 의 결제 상태를 **직접** `CANCELLED` 로 고친다.

```java
paymentRepo.findById(paymentId).ifPresent(payment -> payment.setStatus(cancelledStatus));
```

분리하면 이 줄이 사라진다. 취소는 payment-api 의 이벤트로만 오므로
**보상이 끝난 직후 화면은 여전히 `AUTHORIZED`** 다. 결정 4 의 「확인 중 (n초 전 기준)」 표시를
조회 지연만이 아니라 **보상 직후에도** 걸어야 한다. 안 걸면 "취소했는데 승인으로 보인다"가 된다.

### 2. 릴레이 SQL 이 하드코딩이고, 받는 쪽 컨슈머는 데모 전용이다

`KafkaDemoOutboxRelay.claimPending()` 의 where 절이
`aggregate_type = 'KAFKA_DEMO_ORDER' and event_type = 'ORDER_CREATED'` 로 고정돼 있다.
새 이벤트는 이 릴레이가 안 집는다 — 다만 분리 후엔 payment-api 가 자기 릴레이를 돌리므로
모놀리스 릴레이는 안 건드려도 된다.

문제는 **받는 쪽**이다. `KafkaDemoConsumers` 는 데모 화면 전용이다.
**프로젝션을 채우는 컨슈머를 새로 만들어야 한다.** 문서는 "모놀리스가 받는다"까지만 적었다.

### 3. payment-api 가 async 로 바뀌고 테스트에 postgres 가 필요해진다

지금 `PaymentStore` 는 동기 dict 다. asyncpg 를 넣으면 라우트와 저장이 전부 async 가 된다.
`services/payment-api/tests/test_payment_api.py` 도 DB 를 요구하게 되므로
**CI 의 payment-api 잡에 postgres 서비스 컨테이너를 붙여야 한다.**

### 4. 멱등키 경합 처리

dict 는 단일 프로세스 메모리라 안 겪던 문제다. 유니크 제약으로 옮기면
**같은 키로 동시에 둘이 들어올 때** 하나가 제약 위반을 받는다.
`insert ... on conflict do nothing` 후 **재조회해서 기존 결제를 돌려준다**. 예외로 올리지 않는다.

### 5. 프로젝션 유니크는 `payment_id` 가 아니라 `order_id` 에 건다

화면 조회가 `findByOrderId` 다(`OrderSagaSteps.java:251`). 한 주문에 사본이 둘 생기면
어느 쪽을 보여줄지 정할 수 없다. `order_id` 를 유니크로 잡고 `payment_id` 는 일반 컬럼이다.
`occurred_at` 이 더 최신일 때만 갱신한다 — 이벤트가 순서 없이 와도 과거 상태로 안 되돌아간다.

### 6. 분리가 실제 버그를 하나 고친다

지금 payment-api 를 재시작하면 메모리가 비어서, 그 전 주문의 보상 시 취소가
**404 → `PaymentServiceUnavailableException`** 이 된다(`PaymentClient.java:85-98`).
즉 결제 서비스가 한 번이라도 재시작하면 그 전 주문들의 보상이 깨진다.
DB 로 옮기면 사라진다. **"분리는 비용만 늘린다"에 대한 반례**라 글감으로도 쓴다.

## 리소스

| 신규 pod | requests | limits |
|---|---|---|
| `shipping-api` | 40m / 160Mi | 300m / 256Mi |
| `pg-services` | 50m / 192Mi | 300m / 512Mi |
| `gateway` | 100m / 320Mi | 500m / 512Mi |
| **합** | **190m / 672Mi** | |

여유 10Gi 대비 **6.5%**. NetworkPolicy 는 pod 0개.
신규 pod 이 넷에서 셋으로 준 것은 `pg-payment`·`pg-shipping` 을 `pg-services` 하나로 합쳤기 때문이다.

## 순서 — 왜 이 순서인가

| | 무엇 | 이 자리인 이유 |
|---|---|---|
| 1 | 서비스 지도 (첫 화면 `OrchestrationBoard`) | 분리 **전** 구조를 화면에 고정. 나중 비교 대상이 된다 |
| 2 | 트레이스 캡처 | 분리 **전** 기준선. 자른 뒤와 나란히 놓는다 |
| 3 | **구매자 도입** (결정 6) | 분리 **전**이어야 "이름이 사라졌다"는 대비가 생긴다 |
| 4 | **payment 분리** | 패턴을 여기서 굳힌다. 이 단계가 전체의 절반 |
| 5 | **shipping 분리** | 4의 복제. 절반 이하 분량 |
| 6 | 장애 격리 실증 | 분리 **후**에 해야 "화면은 산다"가 나온다 |
| 7 | **gateway 로 BFF 대체** | 라우팅할 서비스가 넷이 된 뒤에 넣어야 정당하다 |

**1 번은 새 `/architecture` 라우트가 아니라 기존 첫 화면 지도를 키우는 것으로 바꿨다.**
지도가 두 곳에 생기면 분리할 때마다 두 곳을 고쳐야 하고, 그러면 갈린다.

**4 를 끝까지 밀고 나서 5 로 간다.** 둘을 동시에 시작하면 둘 다 절반에서 멈춘다.
비용은 payment-api 를 *두 번* 짓는 것이 아니라 *처음* 짓는 것이다 — 지금 161줄에 DB 도 Kafka 도
없고, 여기에 asyncpg + 스키마 + 아웃박스 + 릴레이 + 컨슈머가 들어간다.

2 와 5 가 전후로 갈리는 것이 원래 계획과 다르다. 분리 전 트레이스가 있어야 비교가 된다.

## 함께 갱신해야 하는 것 — 코드가 아닌 쪽

분리는 코드 작업이자 **이미 쓴 글 대여섯 편의 갱신 작업**이다. 놓치면 화면과 글이 어긋난다.

| 위치 | 무엇 |
|---|---|
| `web/src/components/OrchestrationBoard.tsx` | Workloads·Data 노드와 `owns`/`after` 설명. **1단계에서 이미 넣었다** |
| `web/src/components/OrchestrationBoard.tsx:35` | 각 워크로드 설명 |
| `seed-portfolio-wiki.mjs:459` | FastAPI 서비스 설명 절 |
| `seed-portfolio-wiki.mjs:608` | "trace 를 내는 것은 둘뿐" — 넷으로 바뀐다 |
| `seed-portfolio-wiki.mjs:707` | PR용 `ci.yml` 에 shipping-api 잡 없음 |
| `seed-portfolio-wiki.mjs:715` | "이미지 다섯" → 일곱 |
| `seed-portfolio-wiki.mjs:786`, `:808` | 리소스·CPU 표 |
| `infra/k8s/backup/postgres-backup.yaml` | **백업 대상이 3개 DB 가 된다** |
| `scripts/pull-prod-backup.sh` | 같은 이유 |

**백업이 조용히 깨지는 자리다.** 지금 CronJob 은 `portfolio` 하나만 dump 한다. 분리하면
결제·배송 데이터가 백업 밖으로 나가고, **아무 알림도 안 뜬다.** 4단계(payment 분리)에 반드시 포함한다.

## 리스크

| | 완화 |
|---|---|
| **로그인이 깨진다** (6단계, `Set-Cookie`·TOTP 가 gateway 를 탄다) | 배포 전 로그인·TOTP·글 저장을 수동으로 한 번 |
| **백업이 조용히 빠진다** | 4단계에 백업 스크립트 갱신을 묶는다. 복원 리허설로 확인 |
| NetworkPolicy 가 안 먹는다 | 배포 후 `nc` 로 검증. 안 되면 계정 분리 한 겹 |
| 프로젝션이 영영 안 온다 (컨슈머 죽음) | `observed_at` 이 낡으면 화면이 그 사실을 표시 — 숨기지 않기로 한 것이 여기서 이득 |
| DB drop 이 비가역 | 4·5단계 배포 전 `pull-prod-backup.sh` 를 돌린다 |
| 파이썬 아웃박스가 자바 것과 미묘하게 다르다 | 선점(`for update skip locked`)·트랜잭션 밖 발행 두 규칙을 그대로 옮긴다 |
| **취소 이벤트를 빠뜨린다** | 아웃박스를 승인에만 붙이면 화면이 취소된 결제를 `AUTHORIZED` 로 계속 보인다. **승인·취소 양쪽에 붙인다** |
| 배송 타임아웃이 실패와 섞인다 | "접수 안 됨"과 "접수됐는지 모름"을 구분한다. 후자는 재조회 후 판정 |

## 나올 글 — 초안

분리하면서 나오는 이야기들이다. 제목과 요약만 잡아 둔다.

### 1. 「Kafka 가 있는데 프로세스를 안 건너고 있었다」 (블로그)

아웃박스 릴레이는 잘 짜여 있었다. `for update skip locked` 로 선점하고, Kafka 발행을 트랜잭션
밖에 두고, 선점 타임아웃으로 죽은 프로세스를 회수한다. **그런데 보내는 쪽과 받는 쪽이 같은
프로세스였다.** 구현이 아니라 배치가 놀고 있었다는 이야기. 코드 품질과 아키텍처적 의미는
다른 축이라는 것.

### 2. 「BFF 가 게이트웨이였다는 걸 게이트웨이를 넣으려다 알았다」 (블로그)

Gateway 를 넣으려고 자리를 찾다가 77줄짜리 BFF 프록시가 이미 그 일을 전부 하고 있는 걸 발견한
이야기. 쿠키 전달, IP 보존, 502 래핑, Set-Cookie 되돌리기 — 전부 게이트웨이의 기본 기능이다.
**"넣을 자리가 없다"가 아니라 "이미 있는데 이름이 달랐다".** 상자를 늘린 기록보다 읽힌다.

### 3. 「같은 DB 를 보는 마이크로서비스는 마이크로서비스가 아니다」 (위키, architecture)

데이터 소유권이 왜 MSA 의 유일한 필수 요건인지. 프로세스 분리·독립 배포·비동기 통신을 다
갖추고도 DB 를 공유하면 여전히 모놀리스인 이유. 그리고 **약속이 아니라 강제로 만드는 법** —
DB 계정과 NetworkPolicy 두 겹. `nc` 타임아웃 화면이 증거.

### 4. 「결제 서비스를 껐더니 주문 화면은 살아 있었다」 (블로그)

`replicas: 0` 실증 기록. 새 주문은 승인에서 실패해 보상까지 가고 재고가 원복되는데, 기존 주문
화면은 프로젝션으로 그려져 멀쩡히 뜬다. **쓰기는 동기, 읽기는 비동기로 나눈 판단이 화면에서
증명되는 순간.** 트레이스 두 장(분리 전/후)을 나란히.

### 5. 「백업이 조용히 빠질 뻔했다」 (위키, operations)

DB 를 셋으로 늘리면서 백업 CronJob 은 하나만 보고 있었다는 것. 아무 알림도 안 뜬다.
`never-exercised-code` 의 후속 — **"안 돌아본 코드"가 아니라 "범위가 조용히 어긋난 자동화"**.

### 6. 「왜 서비스가 넷뿐인가」 (위키, architecture — 첫 화면 지도에 붙는 글)

Eureka·Config Server·서비스 메시를 안 넣은 이유를 각각 한 줄로. 그리고 gateway 는 **추가가
아니라 대체**로만 정당하다는 것. 적은 개수가 약점이 아니라 판단으로 읽히게 만드는 글.

### 7. 「Redis 가 어울려 보이는 자리에 postgres 를 썼다」 (블로그)

멱등성 키 저장소는 TTL 있는 키-값이라 Redis 가 교과서적으로 맞아 보인다. 그런데 **유실되면
이중 결제**다. postgres 유니크 제약은 재시작에도 살아남고 결제 행과 같은 트랜잭션에 든다.
"왜 Mongo 안 쓰셨어요"보다 답하기 좋은 질문이 "왜 Redis 를 안 썼냐"이고, 거기 구체적인 답이 있다.

### 8. 「단일 DB 로 테이블만 나누는 게 더 흔하다, 그런데도 인스턴스를 나눈 이유」 (위키, architecture)

실무 다수가 스키마 분리로 가는 이유(백업·모니터링·업그레이드가 N배)를 먼저 인정하고,
그런데도 나눈 근거가 **NetworkPolicy 하나**임을 밝히는 글. "노드가 하나라 이동 이점은 못 씁니다"를
스스로 적는 것이 요점. **되돌리기 쉬운 쪽을 나중으로 미룬다**는 판단 기준까지.

## 참고

- 앞 인계: `.claude/session/handoff-20260817-0230.md`
- 분리 지점: `spring/src/main/java/cloud/leneu/jaywiki/saga/OrderSagaSteps.java:92,197-203,251-252`
- 아웃박스 원본: `spring/src/main/java/cloud/leneu/jaywiki/kafka/KafkaDemoOutboxRelay.java`
- BFF: `web/src/app/api/bff/[...path]/route.ts`
- 서비스 지도: `web/src/components/OrchestrationBoard.tsx`
- 백업: `docs/2026-08-16-backup-completeness-design.md`, `scripts/pull-prod-backup.sh`
