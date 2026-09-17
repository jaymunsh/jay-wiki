# 데이터 분리 전 주문 조회 트레이스 — 기준선 (2026-08-17)

주문 *생성* 기준선(`2026-08-17-saga-trace-before.md`)이 못 담은 **화면 조회 경로**다.
분리의 핵심인 `OrderSagaSteps.view()`(주문 화면이 결제 상태를 읽는 곳)가 여기 있다.
운영에서 실제로 돌린 조회 하나다.

| | |
|---|---|
| traceId | `e7343501e8bb63bf522aa14304d9bd08` |
| sagaId | `saga_b1c2d8f8eed74b93904aef8b9d69303c` |
| orderId | `ord_bc9a9ebee11f422bbe4dd937c0a61050` |
| 요청 | `GET /api/bff/saga/orders/{sagaId}` |
| 결과 | `200`, 사가 `CONFIRMED` |
| 원본 | `2026-08-17-saga-trace-get-before.json` (Tempo `/api/traces/{id}` 응답 그대로) |

## 스팬

```
서비스        스팬                                  시작      길이
──────────────────────────────────────────────────────────────────
jaywiki      http get /api/saga/orders/{sagaId}    0.00ms   9.00ms
jaywiki        security filterchain before         0.41ms   0.29ms
jaywiki        authorize request                   0.61ms   0.06ms
jaywiki        secured request                     0.70ms   7.64ms   ← 여기가 전부다
jaywiki        security filterchain after          8.35ms   0.12ms
```

스팬 **5개**, 서비스 **하나**. 9.00ms.

## 여기서 읽어야 할 것

**프로세스를 넘는 구간이 없다.** 생성 경로에는 결제 승인 하나가 원격이었는데, 조회 경로는
`secured request` 안에서 전부 끝난다. 주문·단계·결제 상태를 모두 **한 DB 의 한 트랜잭션**에서
읽기 때문이고, 그래서 DB 호출이 스팬으로도 안 보인다 — 나눌 경계가 없다.

이 5개가 **분리의 대가를 재는 자리**다. 결제 상태가 남의 DB 로 가면 이 경로는 셋 중 하나가 된다.

| | 스팬 | 조회 지연 | 정합성 |
|---|---|---|---|
| 지금 (분리 전) | 5, 서비스 1 | 9ms | 항상 최신 |
| payment-api 동기 호출 | +2 이상, 서비스 2 | 원격 왕복만큼 늘고 payment 가 죽으면 화면도 죽는다 | 항상 최신 |
| **프로젝션 (택한 것)** | 5, 서비스 1 — **모양이 안 변한다** | 그대로 | **늦는다** (로컬 실측 1.73초) |

프로젝션을 택했으니 **분리 후에도 이 트레이스는 거의 그대로여야 한다.** 스팬이 늘거나
서비스가 둘로 보이면 어딘가에서 원격 조회가 새어 들어간 것이다. 대신 대가는 트레이스가 아니라
**화면의 「n초 전 기준」 표시**로 드러난다.

## 다시 잡는 법

```bash
# 1. 운영에서 주문 하나 만들고 sagaId 를 받는다
S=$(curl -s -X POST https://portfolio.leneu.cloud/api/bff/saga/orders \
  -H 'content-type: application/json' \
  -d '{"productCode":"JAY-HOODIE","quantity":1,"failAt":"NONE","idempotencyKey":"baseline-get-'$(date +%s)'"}')
SID=$(echo "$S" | python3 -c "import json,sys;print(json.load(sys.stdin)['sagaId'])")

# 2. 조회한다 — 이게 재려는 경로다
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' \
  "https://portfolio.leneu.cloud/api/bff/saga/orders/$SID"

# 3. Tempo 에서 찾는다 (miniPC LAN 으로 붙는다. ssh miniPC 는 Cloudflare 로그인을 요구한다)
ssh -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 \
  "kubectl run tq-\$RANDOM -n obs --rm -i --restart=Never --image=curlimages/curl:latest --quiet -- \
   -s 'http://tempo:3200/api/search?q=%7B%20name%3D~%22.*orders.*%22%20%7D&limit=20'"
#    rootTraceName 이 'http get ...' 인 것을 고른 뒤 .../api/traces/<traceId>
```

**출력을 파일로 바로 리다이렉트하면 빈 파일이 나올 때가 있다.** 임시 파일에 받아서 크기를
확인하고 옮긴다.
