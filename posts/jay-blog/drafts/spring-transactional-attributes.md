---
title: "Spring: @Transactional이란?"
slug: spring-transactional-attributes
category: 개념 정리
summary: "@Transactional이 무엇을 하는지부터 속성 일곱 가지까지 정리한다. propagation·isolation·readOnly·timeout·rollbackFor·transactionManager·label이 각각 무엇을 바꾸는지, 어떤 실무 상황에서 쓰는지, 프록시 구조에서 오는 함정까지 담았다."
tags: spring,transactional,transaction,jpa,backend,java
toc: true
syncHash: be7299c38f354b5fe18396ed4fe0d8142512653c996c3feb909b370228ab3dfd
publishedAt: 2026-09-17T06:43:29.687179Z

---

`@Transactional`은 메서드 하나를 트랜잭션으로 감싸는 애노테이션이다. 붙이면 Spring이 메서드 실행 전에 트랜잭션을 열고, 정상 종료면 commit, 예외면 rollback을 해 준다.

"전부 성공하거나 전부 없던 일이거나"를 보장하는 것이 트랜잭션이다. 주문을 저장하고 재고를 차감하고 결제를 기록하는 세 쿼리 중 하나가 실패했을 때, 앞의 둘까지 되돌려 주는 안전장치다. 이걸 매번 try/catch와 commit/rollback으로 직접 쓰는 대신 애노테이션 한 줄로 위임한다.

속성을 하나도 안 쓰면 전부 기본값으로 도는데, 기본값이 모든 상황에 맞지는 않는다. 이 글은 속성 일곱 가지가 각각 무엇을 바꾸는지, 그리고 어떤 실무 상황에서 쓰는지를 정리한다.

## @Transactional은 프록시로 동작한다

속성을 보기 전에 구조를 먼저 잡아 둔다. Spring은 `@Transactional`이 붙은 빈을 프록시 객체로 감싼다. 밖에서 메서드를 부르면 실제 메서드가 아니라 프록시가 먼저 받고, 프록시가 트랜잭션을 연 뒤에 실제 코드를 실행한다.

```
호출자 → 프록시(트랜잭션 시작) → 실제 메서드 → 프록시(commit 또는 rollback)
```

이 구조 하나가 이 글 후반의 함정 대부분을 설명한다. **프록시를 거치지 않는 호출에는 속성이 아예 적용되지 않는다.**

## 속성 한눈에 보기

| 속성 | 기본값 | 무엇을 정하나 |
|---|---|---|
| `propagation` | `REQUIRED` | 이미 트랜잭션이 있을 때 어떻게 할지 |
| `isolation` | DB 기본값 | 동시에 도는 트랜잭션끼리 서로의 변경을 얼마나 볼지 |
| `readOnly` | `false` | 읽기 전용 최적화 힌트 |
| `timeout` | 없음 | 트랜잭션이 살아 있을 수 있는 최대 시간(초) |
| `rollbackFor` / `noRollbackFor` | RuntimeException·Error만 롤백 | 어떤 예외에 롤백할지 |
| `value` / `transactionManager` | 기본 매니저 | 어느 트랜잭션 매니저를 쓸지 |
| `label` | 없음 | 모니터링용 이름표(Spring 6.1+) |

대문자(`REQUIRED`, `READ_COMMITTED`)와 소문자(`readOnly`, `timeout`)가 섞여 보이는데, 의미 차이가 아니라 Java 명명 규칙이다. `propagation`과 `isolation`은 정해진 목록에서 고르는 **enum 상수**라 대문자로 쓰고(`Propagation.REQUIRED`), 나머지는 값을 직접 넣는 **애노테이션 파라미터**라 camelCase다. 그래서 표 아래에서는 enum 둘만 대문자로 나온다.

## propagation — 이미 트랜잭션이 있으면 어떻게 할까

호출한 메서드가 이미 트랜잭션 안일 때, 합류할지·새로 열지·거부할지를 정한다.

| 값 | 동작 |
|---|---|
| `REQUIRED` | 있으면 합류, 없으면 새로 연다. **기본값이고 대부분 이것으로 충분하다** |
| `REQUIRES_NEW` | 바깥 트랜잭션을 일시 정지하고 항상 새 트랜잭션을 연다 |
| `NESTED` | 안쪽에 savepoint를 찍고, 실패하면 그 지점까지만 되돌린다 |
| `SUPPORTS` | 있으면 합류, 없으면 트랜잭션 없이 실행한다 |
| `NOT_SUPPORTED` | 트랜잭션 없이 실행한다. 있으면 일시 정지한다 |
| `MANDATORY` | 트랜잭션이 없으면 예외를 던진다 |
| `NEVER` | 트랜잭션이 있으면 예외를 던진다 |

### `REQUIRED` — 주문 하나가 트랜잭션 하나

**상황**: 주문 생성을 처리하는 서비스가 재고 차감과 포인트 적립을 다른 서비스에 위임한다.

```java
@Transactional   // propagation = REQUIRED
public void createOrder(OrderRequest req) {
    orderRepository.save(order);
    stockService.deduct(req.itemId(), req.quantity());   // 같은 트랜잭션에 합류
    pointService.earn(req.memberId(), req.amount());     // 같은 트랜잭션에 합류
}
```

셋 중 하나가 실패하면 전부 롤백된다. "주문은 됐는데 재고는 안 빠진" 상태를 원천 차단하는 것이 기본값의 일이다. 대부분의 서비스 메서드는 이 값이 정답이다.

### `REQUIRES_NEW` — 바깥이 실패해도 남겨야 하는 기록

**상황 1 — 결제 시도 로그**: 결제가 실패해서 주문 트랜잭션이 롤백돼도, "몇 시에 어떤 금액을 승인 요청했고 PG가 뭐라고 답했는지"는 남아야 한다. 나중에 고객 문의나 결제 대사에 쓰는 자료다.

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordAttempt(PaymentAttempt attempt) {
    // 주문 트랜잭션이 롤백돼도 시도 기록은 별도 트랜잭션으로 남는다
    attemptLogRepository.save(attempt);
}
```

**상황 2 — 외부 연동 요청/응답 원문**: 배송사 API나 PG사와 주고받은 요청·응답을 로그 테이블에 남길 때도 같다. 업무 트랜잭션과 운명을 같이하면 장애 분석 자료가 사라진다.

주의할 점이 두 개 있다. 커넥션을 풀에서 하나 더 가져오므로 커넥션을 두 개 쓰고, 바깥 트랜잭션이 잡은 락을 안쪽이 기다리는 구조가 되면 데드락이 날 수 있다.

### `NESTED` — 본문은 살리고 일부만 되돌리기

`REQUIRES_NEW`와 헷갈리기 쉬운데 둘은 다르다. `NESTED`는 같은 커넥션 안에서 savepoint를 찍는다. 안쪽이 실패하면 savepoint까지 되돌리지만, **바깥이 롤백되면 안쪽도 함께 롤백된다**. `REQUIRES_NEW`는 별도 커넥션이라 바깥과 완전히 갈라진다.

**상황 1 — 대량 처리 중 한 건만 실패**: 이벤트 쿠폰 1,000장을 발급하는데 중간에 한 명의 데이터가 이상하다. 그 한 명만 건너뛰고 나머지를 계속 발급하고 싶다. 각 발급을 `NESTED`로 감싸고 실패하면 그 savepoint만 되돌린다.

**상황 2 — 부가 작업의 실패가 본문을 죽이면 안 될 때**: 회원가입은 완료하되, 그 안의 "가입 경로 기록" 같은 부가 작업이 실패했을 때 그 부분만 되돌리고 싶을 때다.

savepoint 기반이라 JDBC에서는 확실히 동작하고, JPA에서는 드라이버가 savepoint를 지원해야 한다.

### `MANDATORY` — 혼자 돌면 안 되는 메서드에 자물쇠

**상황**: 계좌 이체의 출금 헬퍼나 잔액 차감 메서드. 단독으로 실행되면 "차감만 되고 입금이 빠진" 상태가 되므로, 반드시 바깥 트랜잭션 안에서만 불려야 한다.

```java
@Transactional(propagation = Propagation.MANDATORY)
public void deduct(Long accountId, long amount) {
    // 트랜잭션 없이 호출하면 즉시 예외 — 실수를 실행 시점에 잡는다
}
```

팀이 커지면 "누군가 이 메서드를 트랜잭션 없이 호출하는" 실수가 반드시 나온다. `MANDATORY`는 그 실수를 조용한 데이터 오염 대신 즉시 예외로 바꿔 준다.

### `NOT_SUPPORTED` — 트랜잭션을 잠깐 놓고 외부 호출

**상황**: 주문 트랜잭션 안에서 PG 승인 API를 호출한다. PG 응답이 200ms면 괜찮지만 장애로 30초가 걸리면 그동안 DB 커넥션과 락을 물고 있다. 호출만 트랜잭션 밖으로 빼고 싶다.

```java
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public PaymentResult requestPgApproval(PaymentRequest req) {
    // 트랜잭션이 일시 정지되므로 이 호출 동안 커넥션을 물지 않는다
    return pgClient.approve(req);
}
```

문자 발송, 외부 웹훅 호출, 긴 배치 파일 처리도 같은 상황이다. 트랜잭션의 범위를 DB 작업으로만 좁히는 것이 목적이다.

### `SUPPORTS`와 `NEVER`

`SUPPORTS`는 트랜잭션이 있으면 얹히고 없으면 그냥 실행하는 조회성 헬퍼에 쓴다. 예를 들어 캐시를 먼저 보고 없으면 DB를 읽는 공통 조회 메서드다.

`NEVER`는 "여기는 절대 트랜잭션 밖"을 강제한다. 헬스체크처럼 트랜잭션 자체가 무의미한 메서드에 달아 두면, 실수로 트랜잭션 안에서 불렀을 때 바로 알 수 있다.

## isolation — 동시에 도는 트랜잭션끼리

| 값 | 막는 것 | 남는 것 |
|---|---|---|
| `READ_UNCOMMITTED` | 없음 | dirty read, non-repeatable read, phantom read 전부 가능 |
| `READ_COMMITTED` | dirty read | non-repeatable read, phantom read 가능 |
| `REPEATABLE_READ` | dirty read, non-repeatable read | phantom read 가능(DB에 따라 다름) |
| `SERIALIZABLE` | 전부 | 없음 — 대신 사실상 직렬 실행에 가까워진다 |

`DEFAULT`는 쓰는 DB의 기본값을 그대로 따른다. MySQL InnoDB는 `REPEATABLE_READ`, PostgreSQL·Oracle은 `READ_COMMITTED`가 기본이다.

**상황으로 보면**:

- `READ_COMMITTED` — 상품 목록 조회. 다른 트랜잭션이 아직 커밋 안 한 값은 안 보고 싶다는 최소한의 요구다.
- `REPEATABLE_READ` — 송장·정산서를 만드는 동안 회원 정보를 두 번 읽었을 때 같은 값이어야 한다. MySQL이라면 기본값이 이미 이 수준이다.
- `SERIALIZABLE` — 좌석 선점, 선착순 쿠폰처럼 "읽고 계산하고 쓰는" 사이에 다른 트랜잭션이 끼면 안 되는 경우. 다만 동시성이 크게 꺾이고 직렬화 실패 예외의 재시도까지 설계해야 한다.

실무에서는 **DB 기본값으로 두는 경우가 대부분**이다. 재고 차감처럼 동시성이 문제되는 지점은 격리 수준을 올리기보다 비관적 락(`SELECT ... FOR UPDATE`)이나 낙관적 락으로 푸는 편이 흔하다.

## readOnly — 힌트이지 쓰기 차단 장치가 아니다

**상황**: 상품 목록, 주문 내역, 관리자 대시보드 같은 조회 전용 API다.

```java
@Transactional(readOnly = true)
public List<OrderSummary> listMonthlyOrders(Long memberId) {
    return orderRepository.findMonthly(memberId);
}
```

`readOnly = true`는 "이 트랜잭션은 읽기만 한다"는 힌트다. 무엇이 달라지는가:

- **JPA(Hibernate)**: flush를 생략한다. 변경 감지(dirty checking)용 스냅샷을 안 만들어 조회용 메모리와 CPU를 아낀다.
- **JDBC/커넥션**: 읽기 전용 커넥션으로 표시해, replica로 라우팅하는 구성에서는 읽기 트래픽이 복제본으로 간다.
- **일부 DB**: 읽기 전용 트랜잭션에 최적화를 적용한다.

함정은 이것이 **힌트라는 점**이다. `readOnly = true` 안에서 `INSERT`를 날리면 JPA에서는 flush 생략 때문에 조용히 반영이 안 될 수 있고, 환경에 따라 그냥 실행되기도 한다. "쓰기를 막아 주는 안전장치"로 쓰면 안 되고, 조회 전용 메서드임을 표시하는 용도다.

## timeout — 오래 도는 트랜잭션을 자른다

**상황**: 일일 정산 배치나 월간 리포트 생성처럼 실행 시간이 길어질 수 있는 트랜잭션이다.

```java
@Transactional(timeout = 30)
public void runDailySettlement() { ... }
```

초 단위고, 넘기면 트랜잭션이 롤백된다. 기본은 제한 없음이다. 트랜잭션이 오래 살면 커넥션과 락을 그만큼 오래 점유하므로, 상한을 두는 것 자체가 운영 안전장치다.

## rollbackFor / noRollbackFor — 어떤 예외에 롤백할지

기본 규칙이 의외의 함정이다: **`RuntimeException`과 `Error`만 롤백하고, checked exception은 commit한다.**

**상황 1 — checked 예외로 만든 비즈니스 예외**: 재고 부족, 결제 거절, 한도 초과를 `extends Exception`으로 만들었다면, 그 예외가 나도 트랜잭션은 커밋된다.

```java
@Transactional(rollbackFor = PaymentDeclinedException.class)
public void pay(Order order) throws PaymentDeclinedException {
    // checked exception이라 rollbackFor가 없으면 예외가 나도 앞의 변경이 커밋된다
}
```

**상황 2 — 이 예외는 롤백하지 않을 때**: 알림 발송 실패처럼 본문은 살려야 하는 예외가 런타임 예외라면 `noRollbackFor`로 제외한다.

```java
@Transactional(noRollbackFor = NotificationFailedException.class)
public void completeSignup(...) { ... }
```

## transactionManager — 매니저가 여러 개일 때

**상황**: 주 DB와 분석·로그용 DB처럼 데이터소스가 두 개 이상이면 `PlatformTransactionManager` 빈도 둘이다. 어느 매니저로 트랜잭션을 열지 지정한다.

```java
@Transactional(transactionManager = "replicaTxManager", readOnly = true)
public List<DailyStats> loadStats() { ... }
```

`value`가 같은 속성의 별칭이다. 매니저가 하나면 쓸 일이 없다.

## label — Spring 6.1의 이름표

`label = "order-checkout"`처럼 트랜잭션에 이름을 붙이는 속성이다. APM이나 트랜잭션 이벤트를 수집해 모니터링할 때 어떤 트랜잭션인지 구분하는 용도다. Spring 6.1부터 있고, 쓰지 않아도 되는 선택 속성이다.

## 자주 걸리는 함정

### 같은 클래스 안에서 부르면 적용 안 된다

```java
public void register(Member m) {
    this.sendWelcomeMail(m);   // 프록시를 안 거친다 — @Transactional이 안 먹는다
}

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void sendWelcomeMail(Member m) { ... }
```

`this.`로 부르는 내부 호출(self-invocation)은 프록시를 우회한다. 별도 빈으로 분리하거나, 자기 자신의 프록시를 주입받아 호출해야 한다.

### checked exception은 롤백되지 않는다

위의 rollbackFor 항목과 같은 이야기다. `throws Exception`인 메서드에서 예외가 나도 commit되는 것이 기본이다.

### private·final 메서드에는 못 붙인다

프록시가 메서드를 오버라이드하는 방식이라 `private`은 대상이 아니고, `final` 메서드·클래스는 클래스 기반 프록시로 감쌀 수 없다. 기본은 `public` 메서드이고, 클래스 기반 프록시라면 Spring 6부터 `protected`·package-private도 되지만 `public`으로 두는 편이 예측이 쉽다.

### 트랜잭션 안에서 외부 호출

결제 승인·메시지 발송 같은 외부 호출을 트랜잭션 안에 두면, 그 응답이 느리거나 멈출 때 DB 커넥션과 락이 함께 묶인다. 호출을 트랜잭션 밖으로 빼거나(`NOT_SUPPORTED`), 트랜잭션 범위를 DB 작업만으로 좁히는 편이 낫다.

### `REQUIRES_NEW`의 커넥션 비용

편리해 보여서 남용하면 커넥션 풀이 빨리 마르고, 바깥 트랜잭션의 락과 안쪽의 락이 서로를 기다리는 데드락이 생긴다. "바깥과 결과가 갈라야 하는가"가 기준이다.

## 고르는 기준

- **일단 기본값으로 시작한다.** `REQUIRED` + DB 격리 수준이 대부분의 정답이다.
- 바깥이 롤백돼도 남아야 하는 기록(결제 시도, 연동 원문) → `REQUIRES_NEW`
- 같은 트랜잭션 안에서 부분만 되돌리기(대량 처리의 일부 실패) → `NESTED`
- 트랜잭션 필수인 메서드 강제(잔액·재고 차감) → `MANDATORY`
- 트랜잭션 안의 외부 호출(PG 승인, 문자 발송) → `NOT_SUPPORTED`로 분리
- 조회 전용 메서드(목록, 대시보드) → `readOnly = true`(힌트임을 기억)
- 길어질 수 있는 트랜잭션(정산, 리포트) → `timeout`
- checked 예외를 던지는 메서드 → `rollbackFor` 확인

속성을 늘리기 전에 트랜잭션의 범위가 맞는지 먼저 본다. 속성보다 "트랜잭션이 어디서 열리고 닫히는가"가 더 큰 문제인 경우가 많다.
