# 결제 데이터를 떼어 낸 기록 — MSA 4단계 (2026-08-17)

설계는 `docs/2026-08-17-msa-data-ownership-design.md` 다. 이 문서는 **그 설계 중 4단계를 실제로
어떻게 지었고 무엇으로 확인했는지**만 적는다. 나중에 아키텍처 글을 쓸 때의 재료다.

한 줄로 줄이면 이렇다. **결제의 원본이 모놀리스 DB 를 떠났고, 모놀리스는 그 결과를 이벤트로 전해
듣는 사본만 든다.** 프로세스는 원래 나뉘어 있었다 — 이번에 나뉜 것은 데이터다.

## 전과 후

| | 전 | 후 |
|---|---|---|
| 결제의 원본 | `portfolio` DB 의 `tb_saga_payment` | `pg-services` 의 `payment` DB 의 `tb_payment` |
| payment-api 의 상태 | 프로세스 메모리 (재시작하면 사라짐) | 자기 DB. 멱등키는 유니크 제약 |
| 모놀리스가 결제를 읽는 법 | 같은 트랜잭션에서 `paymentRepo.findByOrderId` | `tb_payment_projection` (이벤트로 채운 사본) |
| 모놀리스가 결제를 쓰는 법 | 승인·취소 모두 직접 씀 | **안 쓴다** |
| 프로세스를 건너는 구간 | 결제 승인 HTTP 하나 | 결제 승인 HTTP + **결제 이벤트 Kafka** |
| 소유권 강제 | 없음 (약속) | 계정 권한 + NetworkPolicy 두 겹 |

## 무엇을 지었나

### 1. payment-api 가 자기 DB 를 든다 (`07666ee`)

`services/payment-api/src/payment_api/db.py`. 테이블 둘 — `tb_payment`, `tb_payment_outbox` —
이고 **둘은 한 트랜잭션**이다. 상태 변경과 "그 사실을 알리겠다"는 약속이 같이 커밋되지 않으면
둘 중 하나만 남는 창이 생긴다.

마이그레이션 도구는 안 넣었다. 테이블이 둘이라 `create table if not exists` 로 충분하다.
멱등키는 유니크 제약이고, 경합은 `on conflict do nothing` 뒤 재조회로 푼다.

**이 변경이 버그를 하나 고쳤다.** 전에는 payment-api 를 재시작하면 메모리가 비어서 그 전 주문의
보상 취소가 404 였다(`PaymentClient` 가 `PaymentServiceUnavailableException` 으로 바꿔 던졌다).
즉 결제 서비스가 한 번이라도 재시작하면 그 전 주문들의 보상이 깨져 있었다.
**"분리는 비용만 늘린다"에 대한 반례**로 쓸 수 있는 사례다.

### 2. 아웃박스 릴레이 (`315582a`)

`relay.py`. 모놀리스의 `KafkaDemoOutboxRelay` 를 파이썬으로 옮겼다 — `for update skip locked` 로
선점하고, **발행은 트랜잭션 밖**이며, 실패한 건은 `NEW` 로 되돌린다.

여기서 Kafka 가 처음으로 프로세스를 건넜다. 그전까지 이 저장소의 카프카는 보내는 쪽과 받는 쪽이
같은 프로세스여서, 이벤트 흐름을 시연은 해도 경계를 건너지는 않았다.

브로커가 없어도 API 는 뜬다(이벤트가 아웃박스에 쌓일 뿐이다). 결제 승인이 Kafka 가용성에
묶이지 않는다는 뜻이고, 이게 아웃박스를 쓰는 이유다.

### 3. 프로젝션 (`32e8cdb`)

`V26__payment_projection.sql` + `PaymentProjection` + `PaymentEventConsumer`.

- 유니크는 `order_id` 에 건다. **화면 조회가 주문 기준**이라, 한 주문에 사본이 둘 생기면 어느 쪽을
  보여줄지 정할 수 없다
- 늦게 온 과거 이벤트는 `occurred_at` 으로 걸러 최신을 안 덮는다
- 시각을 둘 든다. `occurred_at`(원본에서 일어난 때) / `observed_at`(우리가 들은 때)

**이름이 설계의 일부다.** `tb_payment_projection` 은 "결제의 상태"가 아니라 "우리가 마지막으로
들은 결제의 상태"다. 이 이름이 코드를 읽는 사람에게 결과적 일관성을 계속 상기시킨다.

### 4. 모놀리스에서 결제 표를 지웠다 (`5eb7dd9`)

읽기는 3에서 옮겼지만 **쓰기가 남아 있었다.** 승인 시 `paymentRepo.save`, 보상 시 상태 변경.
둘을 걷어내고 `SagaPayment`·`SagaPaymentRepository` 를 지우고 `V27` 로 표를 드롭했다.

남겨 두면 "여기도 결제 상태가 있다"가 되어 다음 사람이 조인한다. 소유권을 문서가 아니라 구조로
만드는 것이 목적이라 지웠다.

부수 효과 하나를 그대로 뒀다 — **취소 직후 잠깐 화면에 `AUTHORIZED` 가 남는다.** 모놀리스가 즉시
쓰지 않고 이벤트를 기다리기 때문이다. 감추지 않는 것이 이 프로젝트의 요지다.

### 5. 인프라 (`f5d574e`, `405a6b0`, `3eec0de`)

| 무엇 | 어디 | 왜 |
|---|---|---|
| `pg-services` StatefulSet + PVC 5Gi + Service | `infra/k8s/data/pg-services.yaml` | 아래 "왜 인스턴스를 나눴나" |
| initdb 스크립트 (`payment` DB, `payment_svc`, `revoke connect from public`) | 같은 파일의 ConfigMap | PUBLIC 기본 CONNECT 를 빼야 계정 분리가 실제로 선다 |
| NetworkPolicy | 같은 파일 | payment-api + 백업 CronJob 만 받는다 |
| `PAYMENT_DB_DSN`, `PAYMENT_KAFKA_BOOTSTRAP` | `infra/k8s/backend/jaywiki-payment-api.yaml` | 없으면 파드가 기동 실패한다 |
| pg-services 를 payment-api **앞**에 apply + `rollout status` 대기 | `.github/workflows/deploy.yml` | payment-api 는 DB 없이 안 뜬다 |
| 백업 대상 둘 | `infra/k8s/backup/postgres-backup.yaml`, `scripts/pull-prod-backup.sh` | 아래 "조용히 깨지는 자리" |

## 판단 셋 — 왜 그렇게 했나

### 인스턴스를 나눈 이유는 NetworkPolicy 하나뿐이다

흔히 드는 이유("다른 노드로 옮길 수 있다")는 **이 환경에서 성립하지 않는다.** miniPC 는 노드가
하나라 postgres 를 둘로 띄워도 같은 커널, 같은 디스크, 같은 전원이다. 그걸 근거로 쓰면 거짓말이다.

성립하는 이유는 하나다. **NetworkPolicy 의 `podSelector` 는 파드 라벨을 본다.** 같은 postgres 에
스키마로만 나누면 네트워크 층에서 구분할 대상이 없고, 소유권 강제가 계정 권한 한 겹으로 줄면서
보여줄 증거가 "그렇게 안 썼습니다" 뿐이 된다.

### 신규 인스턴스는 둘이 아니라 하나다

처음에는 `pg-payment` 와 `pg-shipping` 을 따로 띄우려 했다. 나눠서 얻는 것이 한 칸(payment ↔
shipping 사이 차단)뿐이고, 그 둘은 서로 조인할 일이 없다. 그 한 칸 값으로 pod 하나와 **백업 대상
하나**가 는다. 이 설계가 리스크로 꼽은 자리가 백업이라 하나로 합쳤다.

되돌리는 방향도 이쪽이 맞다. `pg-services` → 인스턴스 둘은 나중에 쉽고(덤프 하나와 커넥션 문자열),
반대로 스키마 분리 → 인스턴스는 어렵다. 그때는 이미 서비스들이 같은 커넥션으로 조인하고 있다.

### 조회 경로는 동기 호출이 아니라 프로젝션이다

화면이 결제 상태를 읽는 자리에서 선택지가 셋이었다.

| | 스팬 | 조회 지연 | 정합성 |
|---|---|---|---|
| 분리 전 | 5, 서비스 1 | 9ms | 항상 최신 |
| payment-api 동기 호출 | 늘어난다 | 원격 왕복만큼. **payment 가 죽으면 화면도 죽는다** | 항상 최신 |
| **프로젝션 (택함)** | 그대로 | 그대로 | **늦는다** |

장애 격리를 정합성보다 위에 뒀다. 대신 늦는다는 사실을 화면에 그대로 적는다.

## 조용히 깨지는 자리 — 백업

**데이터가 두 인스턴스로 갈리는 순간 백업이 한쪽만 뜬다. 그리고 아무 알림도 안 뜬다.**
설계 단계에서 미리 꼽아 뒀고, 이번 단계에 반드시 포함하기로 했다.

- CronJob 은 `dump()` 하나로 `portfolio` 와 `payment` 둘을 뜬다. `set -e` 라 한쪽이 실패하면
  Job 이 실패로 뜬다 — 그게 알림이다
- 백업 파드에 라벨(`app: jaywiki-postgres-backup`)을 붙였다. **NetworkPolicy 가 이 파드도 막기
  때문이다.** 이걸 빠뜨리면 정확히 "조용히 안 남는" 상태가 된다
- `pull-prod-backup.sh` 도 둘을 받는다. sha256 은 파일별 이름을 유지했다 —
  `rehearse-local-restore.sh` 가 `portfolio.dump.sha256` 을 읽는다

## 무엇으로 확인했나

### 분리 전 기준선 (되돌아가서 다시 잴 수 없는 것)

| | 파일 | 값 |
|---|---|---|
| 주문 생성 트레이스 | `docs/baselines/2026-08-17-saga-trace-before.{json,md}` | 스팬 10, 서비스 2, 72.5ms. 원격 구간은 결제 승인 하나 |
| 주문 조회 트레이스 | `docs/baselines/2026-08-17-saga-trace-get-before.{json,md}` | **스팬 5, 서비스 1, 9.00ms. 프로세스를 넘는 구간 없음** |
| 운영 데이터 사본 | `.local-backups/pre-4d-20260817T054811Z/` | dump 182항목·TABLE DATA 29, assets 61항목 |

조회 트레이스가 이번 단계의 대조군이다. 프로젝션을 택했으니 **분리 후에도 이 모양이 유지돼야
한다.** 스팬이 늘거나 서비스가 둘로 보이면 어딘가에서 원격 조회가 새어 들어간 것이다.

### 로컬

- spring 238개 / payment-api 16개 (ruff·basedpyright 0) / web tsc·lint 경고 7·118개
- 성공 경로: 주문 직후 `payment.status = NONE` → 7초 뒤 `AUTHORIZED` + `observedAt`
- **보상 경로: 8초 뒤 프로젝션이 `CANCELLED` 로 따라온다.** 모놀리스가 아무것도 안 썼는데도
  화면이 따라오는 것 — 이번 단계가 실제로 선다는 증거가 이 한 줄이다
- 실측 지연 1.73초 (`occurred_at 05:17:26.05` → `observed_at 05:17:27.78`)

### 운영 (배포 후, 2026-08-17 16:40 KST)

**1. NetworkPolicy 는 실제로 걸린다.** 이게 이 단계의 미확인 전제였다. k3s v1.36.2.

| 어디서 → 어디로 | 결과 |
|---|---|
| 모놀리스 → `pg-services:5432` | **거부** |
| 모놀리스 → `pg-postgresql:5432` (대조군) | 통과 |
| payment-api → `pg-services:5432` | **통과** (`10.43.55.36:5432`) |
| 백업 CronJob → `pg-services` | 통과 (아래 3번) |

대조군을 같이 잰 이유가 있다. 거부만 보면 "서비스가 죽어서 난 거부"와 구분이 안 된다.
엔드포인트가 정상(`10.42.0.246:5432`)이고 payment-api 는 붙는데 모놀리스만 막히므로,
막는 주체가 정책이라는 것이 이 세 줄로 갈린다.

설계에 적어 둔 후퇴 경로(계정 분리 한 겹)는 쓰지 않았다.

**2. 데이터가 실제로 갈렸다.**

```
pg-services / payment  : tb_payment 3행, outbox SENT 5 / NEW 0
portfolio              : tb_saga_payment 없음, tb_payment_projection 3행
```

**3. 백업이 둘 다 뜬다.** CronJob 을 즉시 한 번 돌렸다.

```
portfolio-20260817T074206Z.dump  2.5M  + .sha256
payment-20260817T074206Z.dump    6.2K  + .sha256
```

맥으로 받은 사본도 둘 다 구조 검증을 지났다 — `portfolio` 186항목, `payment` 13항목
(`.local-backups/deploy-20260817T074235Z/`).

**4. 사가가 운영에서 끝까지 돈다.**

| | 즉시 | 8~9초 뒤 |
|---|---|---|
| 성공 경로 | `CONFIRMED`, payment `NONE` | `AUTHORIZED` + `observedAt` |
| 보상 경로 | `FAILED`, payment `NONE` | **`CANCELLED`** |

보상 경로가 이 단계의 핵심 증거다. 모놀리스는 취소 상태를 **한 글자도 쓰지 않는데**
payment-api 가 낸 이벤트만으로 화면이 따라온다.

**5. 조회 경로의 모양이 안 변했다.** 프로젝션을 택한 값이 여기서 확인된다.

| | 분리 전 | 분리 후 |
|---|---|---|
| 스팬 | 5 | **5** |
| 서비스 | 1 | **1** |
| 길이 | 9.00ms | 19.88ms |

스팬과 서비스 수가 같다 — 원격 조회가 새지 않았다. 길이가 는 것은 이 표본이 하나뿐이라
근거로 쓰지 않는다(같은 요청의 분리 전 값도 0.94초 vs 1.04초로 흔들린다).

**6. 나머지** — 공개 화면 200, 블로그 200, `adminTotpEnabled: true`,
위키 정합성 운영 73편/11탭 = 시드와 일치.

### 배포가 세 번 막혔다 — 전부 로컬이 CI·운영과 달라서

이 단계에서 가장 값싼 교훈이라 남긴다. **셋 다 payment-api 가 DB 와 Kafka 를 실제로 쓰게
되면서 처음 드러난 자리**고, 셋 다 로컬에서는 초록불이었다.

| | 무엇이 터졌나 | 로컬이 왜 못 잡았나 | 고친 방법 |
|---|---|---|---|
| 1 | `asyncpg.Pool[...]` import 시 `TypeError` | uv 가 로컬에 3.14 를 깔았고 PEP 649 로 애너테이션을 늦게 평가한다. CI·이미지는 3.12 | `.python-version` 으로 3.12 고정 + `from __future__ import annotations` |
| 2 | 테스트가 `127.0.0.1:5432` 에 `ConnectionRefused` | 로컬엔 `pf-postgres` 가 떠 있다 | verify 잡에 postgres 서비스 컨테이너 |
| 3 | 닫히지 않은 `AIOKafkaProducer` 의 `__del__` | 로컬엔 브로커가 떠 있어 실패 경로를 한 번도 안 지났다 | `start()` 실패 시 `producer.stop()` — **실제 누수였다** |

3번은 테스트만의 문제가 아니었다. 브로커가 죽어 있는 동안 재시작할 때마다 생산자가 하나씩
남는다. **CI 가 없었으면 운영에서만 천천히 드러났을 버그다.**

교훈을 한 줄로 줄이면 이렇다. **"로컬에 떠 있어서 안 겪은 것"이 실패의 공통 원인이었다.**
버전은 파일로 못 박고, 의존하는 외부 것이 없을 때의 경로는 테스트로 한 번은 지나야 한다.

## 남은 것

| | 무엇 | 왜 지금이 아닌가 |
|---|---|---|
| 5단계 | shipping 분리 | **끝났다** (2026-08-17). 기록은 `docs/2026-08-17-msa-5d-implementation-record.md` |
| 6단계 | 장애 격리 실증 | 분리 **후**에 해야 "결제가 죽어도 화면은 산다"가 나온다 |
| 7단계 | gateway 로 BFF 대체 | 라우팅할 서비스가 넷이 된 뒤에야 정당하다. 지금 넣으면 홉만 는다 |

그리고 **아직 안 나뉜 것을 화면에 그리지 않는다.** 지도에는 `pg-services` 한 칸만 늘었고,
`shipping-api`·`gateway` 칸은 실제로 뜬 뒤에 붙인다. 포트폴리오 첫 화면에 로드맵을 두지 않는다.
