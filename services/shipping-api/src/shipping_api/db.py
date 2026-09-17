"""배송 서비스가 자기 데이터를 드는 곳.

payment-api 의 db.py 와 같은 모양이다(4단계의 복제라는 것이 5단계의 요지다). 다른 것은 둘뿐이다.

- 금액이 없다. 배송은 주문 하나에 접수 한 건이고 돈을 안 든다
- 취소가 없다. 사가에서 배송은 마지막 단계라 뒤에 실패할 것이 없다 --
  배송이 실패하면 보상은 결제 취소와 재고 해제 쪽으로 간다

tb_shipping_outbox 를 같은 트랜잭션에 쓰는 것은 그대로다. 접수를 저장했는데 이벤트를 못 내면
모놀리스의 사본이 조용히 REQUESTED 를 못 보고 NONE 으로 남는다.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Final, Self, cast, final

import asyncpg

if TYPE_CHECKING:
    from collections.abc import Sequence
    from datetime import datetime, timedelta

SCHEMA: Final = """
create table if not exists tb_shipping (
    id text primary key,
    order_id text not null,
    status text not null,
    idempotency_key text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_shipping_order on tb_shipping (order_id);

create table if not exists tb_shipping_outbox (
    id bigserial primary key,
    shipment_id text not null,
    order_id text not null,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'NEW',
    created_at timestamptz not null default now(),
    claimed_at timestamptz,
    sent_at timestamptz
);

create index if not exists ix_shipping_outbox_pending on tb_shipping_outbox (status, created_at);
"""


@final
class ShipmentRow:
    """배송 접수 한 건. asyncpg.Record 를 그대로 흘리지 않으려고 감싼다."""

    __slots__ = ("id", "occurred_at", "order_id", "status")

    def __init__(
        self,
        shipment_id: str,
        order_id: str,
        status: str,
        occurred_at: datetime,
    ) -> None:
        """열 넷을 그대로 받는다."""
        self.id = shipment_id
        self.order_id = order_id
        self.status = status
        # 이 사실이 '여기서' 일어난 시각이다. 받는 쪽이 순서를 판단하는 근거라 DB 시계를 쓴다.
        self.occurred_at = occurred_at

    @classmethod
    def of(cls, record: asyncpg.Record) -> Self:
        return cls(
            cast("str", record["id"]),
            cast("str", record["order_id"]),
            cast("str", record["status"]),
            cast("datetime", record["updated_at"]),
        )


@final
class OutboxRow:
    """아직 안 보낸 이벤트 한 건."""

    __slots__ = ("event_id", "event_type", "order_id", "payload", "shipment_id")

    def __init__(
        self,
        event_id: int,
        shipment_id: str,
        order_id: str,
        event_type: str,
        payload: str,
    ) -> None:
        """아웃박스 한 행을 그대로 받는다."""
        self.event_id = event_id
        self.shipment_id = shipment_id
        self.order_id = order_id
        self.event_type = event_type
        self.payload = payload


@final
class ShippingRepository:
    """배송 접수 저장과 아웃박스 기록. 둘은 반드시 한 트랜잭션이다."""

    def __init__(self, pool: asyncpg.Pool[asyncpg.Record]) -> None:
        """열린 풀을 받아 둔다."""
        self._pool = pool

    async def request(
        self,
        shipment_id: str,
        order_id: str,
        idempotency_key: str,
    ) -> ShipmentRow:
        """접수를 저장하고 같은 트랜잭션에 이벤트를 남긴다.

        같은 멱등키로 동시에 둘이 들어오면 하나는 유니크 제약에 걸린다. 예외로 올리지 않고
        on conflict do nothing 뒤에 재조회해서 먼저 만들어진 접수를 그대로 돌려준다.
        재조회 결과가 없을 수는 없다 -- 제약에 걸렸다는 것은 행이 이미 있다는 뜻이다.
        """
        async with self._pool.acquire() as conn, conn.transaction():
            inserted = await conn.fetchrow(
                """
                insert into tb_shipping (id, order_id, status, idempotency_key)
                values ($1, $2, 'REQUESTED', $3)
                on conflict (idempotency_key) do nothing
                returning id, order_id, status, updated_at
                """,
                shipment_id,
                order_id,
                idempotency_key,
            )
            if inserted is None:
                existing = await conn.fetchrow(
                    """
                    select id, order_id, status, updated_at
                    from tb_shipping where idempotency_key = $1
                    """,
                    idempotency_key,
                )
                if existing is None:  # pragma: no cover - 제약에 걸렸으면 행이 있다
                    msg = f"idempotency conflict without row: {idempotency_key}"
                    raise RuntimeError(msg)
                return ShipmentRow.of(existing)

            row = ShipmentRow.of(inserted)
            await self._append_outbox(conn, row, "SHIPPING_REQUESTED")
            return row

    async def claim_pending(self, limit: int, claim_timeout: timedelta) -> Sequence[OutboxRow]:
        """보낼 이벤트를 선점한다.

        payment-api 와 같은 두 규칙이다. 선점을 for update skip locked 로 감싸 replica 가
        둘일 때 중복 발행을 막고, Kafka 발행은 이 트랜잭션 밖에서 한다.

        claim_timeout 은 timedelta 이고 SQL 에는 ::interval 캐스트가 함께 필요하다. 둘 다여야 한다.
        문자열을 넘기면 asyncpg 가 DataError 를 내고, 캐스트를 빼면 postgres 가 $2 를
        timestamptz 로 추론해 now() - $2 가 interval 이 되면서 비교가 깨진다.
        """
        async with self._pool.acquire() as conn:
            records = await conn.fetch(
                """
                update tb_shipping_outbox
                set status = 'CLAIMED', claimed_at = now()
                where id in (
                    select id from tb_shipping_outbox
                    where status = 'NEW'
                       or (status = 'CLAIMED' and claimed_at < now() - $2::interval)
                    order by created_at
                    limit $1
                    for update skip locked
                )
                returning id, shipment_id, order_id, event_type, payload::text as payload
                """,
                limit,
                claim_timeout,
            )
        return [
            OutboxRow(
                cast("int", r["id"]),
                cast("str", r["shipment_id"]),
                cast("str", r["order_id"]),
                cast("str", r["event_type"]),
                cast("str", r["payload"]),
            )
            for r in records
        ]

    async def mark_sent(self, event_id: int) -> None:
        async with self._pool.acquire() as conn:
            _ = await conn.execute(
                "update tb_shipping_outbox set status = 'SENT', sent_at = now() where id = $1",
                event_id,
            )

    async def release(self, event_id: int) -> None:
        """발행에 실패하면 NEW 로 되돌린다. 다음 주기가 다시 집는다."""
        async with self._pool.acquire() as conn:
            _ = await conn.execute(
                "update tb_shipping_outbox set status = 'NEW', claimed_at = null where id = $1",
                event_id,
            )

    @staticmethod
    async def _append_outbox(
        conn: asyncpg.pool.PoolConnectionProxy[asyncpg.Record],
        row: ShipmentRow,
        event_type: str,
    ) -> None:
        payload = json.dumps(
            {
                "shipmentId": row.id,
                "orderId": row.order_id,
                "status": row.status,
                "eventType": event_type,
                "occurredAt": row.occurred_at.isoformat(),
            },
            ensure_ascii=False,
        )
        _ = await conn.execute(
            """
            insert into tb_shipping_outbox (shipment_id, order_id, event_type, payload)
            values ($1, $2, $3, $4::jsonb)
            """,
            row.id,
            row.order_id,
            event_type,
            payload,
        )


async def open_pool(dsn: str) -> asyncpg.Pool[asyncpg.Record]:
    """풀을 열고 스키마를 만든다.

    테이블이 둘뿐이라 마이그레이션 도구를 넣지 않는다. create table if not exists 로 충분하다.
    """
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)
    async with pool.acquire() as conn:
        _ = await conn.execute(SCHEMA)
    return pool
