# 배송을 떼어 낸 기록 — MSA 5단계 (2026-08-17)

설계는 `docs/2026-08-17-msa-data-ownership-design.md`, 직전 단계 기록은
`docs/2026-08-17-msa-4d-implementation-record.md` 다. **이 문서는 4단계의 복제를 실제로 복제해 봤을 때
무엇이 같았고 무엇이 달랐는지**를 적는다.

한 줄로 줄이면 이렇다. **두 번째 사례가 생겼다.** 하나만 있으면 특수한 처리로 보이지만, 같은 모양이
둘이면 패턴이다.

## 전과 후

| | 전 | 후 |
|---|---|---|
| 배송의 원본 | `portfolio` DB 의 `tb_saga_shipping` | `pg-services` 의 `shipping` DB 의 `tb_shipping` |
| 배송 요청 | 모놀리스가 row 하나 삽입 (`requestShipping()`) | `shipping-api` 에 HTTP POST |
| 실패 주입 판정 | 모놀리스가 자기 안에서 `failAt` 을 보고 분기 | **shipping-api 가 409 를 낸다** |
| 모놀리스가 배송을 읽는 법 | `shippingRepo.findByOrderId` | `tb_shipping_projection` (이벤트로 채운 사본) |
| 화면의 배송 칸 | `REQUESTED` | `REQUESTED (2초 전 기준)` |
| 프로세스를 건너는 구간 | 결제 HTTP + 결제 이벤트 | **거기에 배송 HTTP + 배송 이벤트** |

## 4단계와 같았던 것 — 그래서 값이 있다

`services/shipping-api` 는 `payment-api` 의 구조를 그대로 옮겼다. 파일 이름도 같고
(`db.py`, `relay.py`, `main.py`), 릴레이는 `for update skip locked` 선점과 트랜잭션 밖 발행까지
글자 그대로 같다. 모놀리스 쪽도 `ShippingProjection` · `ShippingEventConsumer` 가
`Payment*` 와 한 글자 차이다.

**복제가 쉬웠다는 사실 자체가 4단계의 결과다.** 첫 사례에서 정한 것들 — 아웃박스를 같은 트랜잭션에
쓴다, `order_id` 에 유니크를 건다, `occurred_at`/`observed_at` 을 둘 다 든다, 프로젝션에 쓰는 곳은
컨슈머 하나뿐이다 — 이 판단들이 두 번째에서는 질문이 아니었다.

배포가 막힐 자리도 미리 알고 있었다. 4단계에서 세 번 막혔던 셋(3.14 애너테이션, CI 의 postgres,
닫히지 않은 Kafka 생산자)을 **처음부터 넣고 시작했다.** `.python-version` 3.12,
`from __future__ import annotations`, `start()` 실패 시 `producer.stop()`.

## 4단계와 달랐던 것

### 1. 취소가 없다

배송은 사가의 마지막 단계라 뒤에 실패할 것이 없다. 그래서 `/shipments/{id}/cancel` 을 만들지
않았다. 배송이 실패하면 보상은 결제 취소와 재고 해제 쪽으로 가고, 그 경로는 이미 있다.

결제 쪽에서 "취소도 이벤트를 내야 한다"가 조용히 틀리는 자리였다면, 배송 쪽의 대응물은
**실패했을 때 아무것도 남기지 않는 것**이다. 409 를 낸 요청은 행도 이벤트도 만들지 않는다.
남기면 보상이 끝난 뒤에도 화면에 배송이 떠 있게 된다.

### 2. 실패 판정이 옮겨 갔다

전에는 `OrderSagaService` 가 `failAt == SHIPPING_REQUEST` 를 보고 자기 안에서 분기했다.
이제는 그 값을 요청에 실어 보내고 **shipping-api 가 409 를 돌려준다.** 모놀리스는 남의 실패를
받아 보상으로 넘어갈 뿐이다.

이 차이가 6단계(장애 격리 실증)의 준비이기도 하다. 실패가 프로세스 안의 `if` 였을 때는
그 프로세스를 죽이는 실험이 성립하지 않는다.

### 3. 인스턴스를 안 늘렸다

`pg-services` 하나에 DB 를 하나 더 넣었다. 계정으로 가른다 —
`revoke connect on database shipping from public` 을 같이 해야 `payment_svc` 가 못 붙는다.
이 두 줄이 계정 분리의 알맹이고, 빼면 나눈 것이 이름뿐이 된다.

**initdb 스크립트는 이미 뜬 인스턴스에서 안 돈다.** 데이터 디렉터리가 빈 첫 기동에만 실행된다.
그래서 운영에는 `kubectl -n data exec pg-services-0 -- psql` 로 직접 만들어야 한다.
저장소의 ConfigMap 은 클린 클러스터 재현용으로 남긴다. 절차는 `docs/deploy-runbook.md` 에 적었다.

### 4. 백업 대상이 셋이 됐다

4단계에서 "조용히 깨지는 자리"로 꼽아 둔 곳이라 이번에도 같은 자리에 같이 넣었다 —
CronJob 의 `dump()` 호출 한 줄과 `pull-prod-backup.sh` 한 블록. `set -e` 라 하나가 실패하면
Job 이 실패로 뜬다.

## 무엇으로 확인했나

### 로컬 (2026-08-17)

- shipping-api 14개 (ruff·basedpyright 0) / spring 238개 / web tsc·lint 경고 7·118개
- **성공 경로**: 사가가 `CONFIRMED` 로 끝나고 즉시 배송은 `NONE`,
  약 1초 뒤 프로젝션이 `REQUESTED` + `observedAt` 으로 따라온다
  (`tb_shipping` 1행, 아웃박스 `SENT` 1건)
- **보상 경로**: shipping-api 가 409 → 단계가
  `SHIPPING_REQUESTED(FAILED)` → `PAYMENT_CANCELLED` → `INVENTORY_RELEASED` → `ORDER_FAILED`,
  결제 프로젝션은 9초 뒤 `CANCELLED` 로 따라오고 **배송 프로젝션은 끝까지 `NONE`** 이다.
  실패한 배송이 아무 사실도 남기지 않는다는 것이 이 줄이다

### 운영

배포 전이다. 배포 후 확인할 것은 4단계와 같은 자리다 — NetworkPolicy 대조군 셋,
백업 세 개가 다 뜨는지, 사가 두 경로, 조회 트레이스가 스팬 5 / 서비스 1 을 유지하는지.

## 남은 것

| | 무엇 | 왜 지금이 아닌가 |
|---|---|---|
| 6단계 | 장애 격리 실증 | 이제 성립한다. `replicas: 0` 으로 내려 화면이 사는지 본다 |
| 7단계 | gateway 로 BFF 대체 | 라우팅할 서비스가 넷이 됐다. 이제 정당해진다 |

그리고 **배송 서비스가 죽었을 때의 사가 흐름은 아직 안 다뤘다.** `ShippingServiceUnavailableException`
은 503 으로 나가지만, 그 순간 결제는 이미 승인돼 있고 취소되지 않는다 — 결제와 같은 자리에 있던
한계가 하나 더 생겼다. 응답이 안 오는 것과 실패는 다르다는 설계 문서의 지적이 여기 그대로 남아 있다.
