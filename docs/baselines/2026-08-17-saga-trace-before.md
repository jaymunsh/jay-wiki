# 데이터 분리 전 사가 트레이스 — 기준선 (2026-08-17)

분리한 뒤와 나란히 놓으려고 **자르기 전**에 잡아 둔 것이다. 운영에서 실제로 돌린 주문 하나다.

| | |
|---|---|
| traceId | `d9ef71ce30fdcc8769d46394ee5adae2` |
| sagaId | `saga_75e208f0dc37413d8749dede9cd3ec8c` |
| orderId | `ord_aa740a55b80d45fba5f166690c9bd5dd` |
| 요청 | `POST /api/saga/orders` — `JAY-HOODIE` 1개, `failAt: NONE` |
| 결과 | `CONFIRMED` (5단계 전부 SUCCESS) |
| 원본 | `2026-08-17-saga-trace-before.json` (Tempo `/api/traces/{id}` 응답 그대로) |

## 스팬

```
서비스                 스팬                                    시작      길이
────────────────────────────────────────────────────────────────────────────
jaywiki               http post /api/saga/orders              0.0ms    72.5ms
jaywiki                 security filterchain before           0.3ms     0.4ms
jaywiki                 authorize request                     0.5ms     0.1ms
jaywiki                 secured request                       0.7ms    71.5ms
jaywiki                   http post                          25.6ms     7.5ms   ← 결제 호출
jaywiki-payment-api         POST /payments/authorize         29.9ms     1.5ms
jaywiki-payment-api           http receive                   30.3ms     0.1ms
jaywiki-payment-api           http send                      30.9ms     0.1ms
jaywiki-payment-api           http send                      31.3ms     0.0ms
jaywiki                 security filterchain after           72.3ms     0.1ms
```

스팬 10개, 서비스 **둘** — `jaywiki` 6개, `jaywiki-payment-api` 4개.

## 여기서 읽어야 할 것

**프로세스 경계를 넘는 구간이 하나뿐이다.** `http post`(25.6ms) → `POST /payments/authorize`.
결제 **승인**만 원격이다.

나머지는 전부 `jaywiki` 안에서 끝난다. 재고 예약도, 배송 요청도, **결제 상태 저장도** 로컬 DB 다.
그래서 트레이스에 DB 호출이 스팬으로 안 보인다 — 같은 트랜잭션이라 나눌 경계가 없다.

**분리한 뒤 무엇이 달라져야 하나**

| | 지금 | 분리 후 |
|---|---|---|
| 원격 구간 | 결제 승인 하나 | 결제 승인 + 배송 요청 |
| 결제 상태 저장 | 스팬 없음 (모놀리스 로컬 DB) | payment-api 안에서 자기 DB 에 쓰는 스팬 |
| 주문 화면 조회 | 스팬 없음 (`paymentRepo.findByOrderId`) | 프로젝션 읽기 — 여전히 로컬이지만 **원본이 아니다** |
| 서비스 수 | 2 | 4 (payment-api, shipping-api, gateway 추가) |

**주의 — 화면 조회 트레이스는 따로 잡아야 한다.** 이 트레이스는 주문 *생성* 경로다.
분리의 핵심인 `OrderSagaSteps:251`(주문 화면이 결제 상태를 읽는 곳)은 여기 안 나온다.
`GET` 경로 기준선은 따로 잡았다 → `2026-08-17-saga-trace-get-before.md`.

## 다시 잡는 법

```bash
# 1. 운영에서 주문 하나
curl -s -X POST https://portfolio.leneu.cloud/api/bff/saga/orders \
  -H 'content-type: application/json' \
  -d '{"productCode":"JAY-HOODIE","quantity":1,"failAt":"NONE","idempotencyKey":"baseline-'$(date +%s)'"}'

# 2. Tempo 에서 찾는다 (miniPC 안에서만 닿는다)
ssh -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 \
  "kubectl run tq-\$RANDOM -n obs --rm -i --restart=Never --image=curlimages/curl:latest --quiet -- \
   -s 'http://tempo:3200/api/search?q=%7B%20name%3D~%22.*orders.*%22%20%7D&limit=20'"

# 3. 트레이스를 꺼낸다
#    .../api/traces/<traceId>
```

`ssh miniPC` 는 Cloudflare 로그인을 요구한다. **LAN 주소로 붙어야 한다.**
