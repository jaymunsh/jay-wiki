---
title: "멱등성 키를 Redis 대신 결제 행의 유니크 컬럼에 뒀다"
slug: idempotency-key-in-payment-row
tab: "백엔드"
parentId: backend
sortOrder: 10
kind: adr
tags: postgresql,redis,idempotency,saga,transaction
source: scripts/seed-portfolio-wiki.mjs
---
- 결제 멱등성 키를 Redis와 PostgreSQL 중 어디에 둘 것인가를 정한 기록이다.
- 키-값·TTL 이라는 데이터 모양이 아니라 잃었을 때 무슨 일이 나는가를 기준으로, 결제 행과 같은 트랜잭션에 드는 PostgreSQL 유니크 제약을 택했다.
- payment-api 의 db.py 구현(on conflict do nothing 뒤 재조회)과, 분리 배포 후 보상 경로에서 payment-api 이벤트만으로 약 8초 뒤 화면이 CANCELLED 로 따라오는 것을 운영에서 확인했다.

## 맥락 — 재시작 한 번에 보상 경로가 전부 죽어 있었다

payment-api 를 재시작할 때마다 그 전 주문들의 보상이 깨져 있었다. 주문 사가는 배송 요청이 실패하면 이미 승인된 결제를 취소하는 보상 단계로 가는데, payment-api 가 결제 상태를 프로세스 메모리의 파이썬 dict 로 들고 있던 동안에는 재시작 한 번에 그 dict 가 통째로 비었다. 그 뒤에 들어오는 취소 요청은 존재하지 않는 결제를 가리키니 404 고, 모놀리스의 PaymentClient 는 그걸 PaymentServiceUnavailableException 으로 바꿔 던졌다. 결제 서비스가 한 번이라도 재시작하면 그 전 주문들의 보상 경로가 전부 죽어 있었다는 뜻이다.

이 사고는 결제 데이터를 payment-api 자신의 PostgreSQL 로 옮기면서 같이 사라졌다. 그 과정에서 정해야 할 것이 하나 남았다. 멱등성 키를 어디에 둘 것인가.

## 후보 — Redis 가 교과서적으로 맞아 보였지만 기각했다

멱등성 키의 쓰임새만 보면 Redis 가 정답처럼 생겼다. 키 하나에 값 하나, 일정 시간이 지나면 버려도 되고, 조회는 빠를수록 좋다. TTL 있는 키-값 저장소의 전형적인 용례다. 실제로 이 프로젝트는 Redis 를 이미 여러 자리에서 쓰고 있다 — 검색 캐시, 조회수 중복 제거, 랜덤 채팅 방에 더해 게시판 레이트리밋, TOTP 상태, HPA 리허설 락까지 여섯이다.

| 자리 | 무엇을 드나 | 잃으면 |
|---|---|---|
| 검색 캐시 (SearchService) | 검색 결과, TTL 60초 | 다음 요청이 DB 를 다시 읽는다 |
| 조회수 중복 제거 (ArticleService, SiteStatsService) | 방문 표식, 하루치 | 중복 제거가 한 번 느슨해진다 |
| 랜덤 채팅 방 (ChatRoomService) | 입장 인원·이벤트 스트림 | 방이 비워진다. 임시 상태라 설계상 허용이다 |

셋의 공통점은 **잃어도 되는 데이터만 든다**는 것이다. ArticleService 의 주석이 그대로 적고 있다 — Redis 가 비어도 조회수 자체는 PostgreSQL 에 있어 잃지 않고, 중복 제거만 한 번 느슨해진다. 이 프로젝트에서 Redis 의 자리는 처음부터 그렇게 잡혀 있었다.

멱등성 키는 그 반대편에 있다. 키가 유실된 채로 클라이언트가 재시도하면, 서버는 그 요청을 처음 보는 것으로 판단하고 결제를 한 번 더 승인한다. 이중 결제다. 검색 캐시가 날아가면 DB 를 한 번 더 읽지만, 멱등성 키가 날아가면 돈이 두 번 나간다. 같은 키-값 모양이라고 같은 저장소에 둘 수 있는 것이 아니다.

기각 사유를 내구성으로만 적으면 절반이다. Redis 도 AOF 를 켜면 어느 정도 버틴다. 더 결정적인 것은, 키를 Redis 에 두는 순간 키와 결제가 서로 다른 저장소에 갈라진다는 사실이다. 키를 먼저 쓰고 결제 저장이 실패하면, 클라이언트의 재시도는 "이미 처리됨"을 받는데 실제 결제는 없다. 결제를 먼저 쓰고 키 기록이 실패하면, 재시도가 결제를 하나 더 만든다. 순서를 어느 쪽으로 잡아도 창은 남고, 그 창을 메우려면 두 저장소에 걸친 정리 로직이 필요해진다.

## 결정 — 멱등성 키를 결제 행의 유니크 컬럼으로 둔다

payment-api 의 db.py 에서 멱등성 키는 별도 저장소가 아니라 결제 테이블의 컬럼이고, 유니크 제약이 걸려 있다.

~~~sql
create table if not exists tb_payment (
    id text primary key,
    order_id text not null,
    amount_cents int not null,
    status text not null,
    idempotency_key text not null unique,
    ...
);
~~~

같은 행의 컬럼이면 두-저장소 문제가 존재하지 않는다. 키만 남고 결제가 없는 상태도, 결제만 있고 키가 없는 상태도 만들 수 없다. insert 하나가 원자적으로 둘 다이기 때문이다. 이 프로젝트는 여기서 한 발 더 가서 아웃박스 행까지 같은 트랜잭션에 묶는다 — 결제를 저장했는데 이벤트를 못 내면 모놀리스의 사본이 조용히 틀리기 때문인데, 그 이야기는 [사가와 아웃박스 문서](/wiki/saga-kafka-outbox-order)에 있다.

## 경합은 예외가 아니라 재조회로 푼다

dict 였을 때는 안 겪던 문제가 하나 생겼다. 단일 프로세스 메모리에서는 같은 키로 동시에 둘이 들어올 일이 없지만, DB 의 유니크 제약으로 옮기면 동시 요청 중 하나가 제약 위반을 받는다. db.py 의 authorize 는 이렇게 푼다.

~~~python
inserted = await conn.fetchrow(
    """
    insert into tb_payment (id, order_id, amount_cents, status, idempotency_key)
    values ($1, $2, $3, 'AUTHORIZED', $4)
    on conflict (idempotency_key) do nothing
    returning id, order_id, amount_cents, status, updated_at
    """,
    ...
)
if inserted is None:
    existing = await conn.fetchrow(
        "select ... from tb_payment where idempotency_key = $1", idempotency_key
    )
    return PaymentRow.of(existing)
~~~

on conflict do nothing 뒤에 재조회해서, 먼저 만들어진 결제를 그대로 돌려준다. 제약 위반을 예외로 올리는 쪽이 코드는 짧지만 의미가 틀린다. 멱등성의 약속은 "같은 요청은 같은 답을 받는다"이지 "두 번째 요청은 에러를 받는다"가 아니다. 재시도한 클라이언트 입장에서 그 요청은 정상 요청이고, 받아야 할 것은 500 이 아니라 처음 요청이 받았을 그 결제다. 제약에 걸렸다는 것은 그 키의 행이 이미 있다는 뜻이라 재조회가 비는 경우는 논리적으로 없다(코드는 그래도 방어적으로 확인한다).

이 패턴은 shipping-api 의 db.py 에도 같은 모양으로 있고, 모놀리스 쪽도 주문 자체의 멱등키를 tb_saga_order 의 컬럼으로 들고 findByIdempotencyKey 로 먼저 조회한다. 세 프로세스가 같은 답을 낸 셈이다.

## 결과 — 재시작 사고가 존재할 수 없게 됐다

MSA 데이터 분리에는 "분리는 비용만 늘린다"는 반론이 따라다닌다. 실제로 비용은 늘었다 — DB 인스턴스가 하나 늘었고, 백업 대상이 늘었고, 화면은 결제 상태를 이벤트로 전해 듣느라 잠깐 늦는다. 그런데 이 건은 반례다. 결제 상태가 모놀리스 DB 와 payment-api 메모리에 걸쳐 있던 구조 자체가 재시작 사고의 원인이었고, 소유권을 payment-api 의 DB 하나로 모으자 그 버그는 고친 것이 아니라 **존재할 수 없게** 됐다. 상태가 프로세스 수명에 묶여 있지 않으니 재시작이 아무것도 지우지 않는다.

운영에서도 확인했다. 분리 배포 후 보상 경로를 돌리면, 모놀리스는 취소 상태를 한 글자도 쓰지 않는데 payment-api 가 낸 이벤트만으로 8초쯤 뒤 화면이 CANCELLED 로 따라온다.

되돌리는 법도 남겨 둔다. Redis 로 옮겨야 할 이유가 생기면(예: 키 조회가 결제 경로의 병목으로 실측될 때), tb_payment 의 idempotency_key 유니크 제약을 그대로 둔 채 Redis 를 앞단 캐시로만 얹는 것이 안전한 경로다. Redis 를 정본으로 삼는 되돌림은 위의 두-저장소 창을 다시 여는 것이라, 그때는 이 문서의 기각 사유를 다시 반박해야 한다.

## 남은 한계 — TTL도 본문 대조도 취소 멱등키도 없다

- **키에 TTL 이 없다.** Redis 를 안 쓰면서 TTL 도 같이 버렸다. tb_payment 행이 만료 없이 쌓이는데, 지금은 데모 데이터 수십 행 규모라 문제가 아니다. 실제 트래픽이라면 오래된 키를 지우는 배치가 필요하고, 그때 "얼마나 오래 재시도를 허용할 것인가"라는 설계 질문이 따라온다.
- **유니크 제약은 중복만 막지, 같은 키로 온 요청의 내용이 같은지는 안 본다.** 같은 키에 다른 금액을 실어 보내면 조용히 먼저 만들어진 결제를 돌려준다. 요청 본문의 해시를 함께 저장해 대조하는 구현들이 있는데, 여기는 안 넣었다.
- **취소 경로에는 멱등키가 없다.** cancel 은 id 로 상태를 CANCELLED 로 덮는 갱신이라 두 번 불러도 결과는 같지만, 부를 때마다 아웃박스 이벤트가 하나씩 더 나간다. 프로젝션이 상태만 반영하니 화면은 안 틀리는데, 이벤트 수를 세는 소비자가 생기면 문제가 된다.

Redis 가 틀린 도구라는 이야기가 아니다. 이 프로젝트에서 Redis 는 [랜덤 채팅의 동시 입장 제어](/wiki/redis-random-chat-queue) 같은, 잃어도 되고 원자성이 명령 단위면 충분한 자리에서 잘 일하고 있다. 멱등성 키가 그 자리가 아니었을 뿐이다. 저장소를 고르는 기준은 데이터의 모양(키-값, TTL)이 아니라 **잃었을 때 무슨 일이 나는가**였다.
