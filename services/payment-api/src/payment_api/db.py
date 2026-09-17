"""결제 서비스가 자기 데이터를 드는 곳.

여기 있는 두 테이블이 MSA 데이터 분리의 알맹이다. 전에는 결제 상태를 모놀리스 DB 의
tb_saga_payment 가 들고 있었고 이 서비스는 파이썬 dict 뿐이라, 프로세스만 나뉘고
데이터는 한 덩어리였다.

tb_payment_outbox 를 같은 트랜잭션에 쓰는 것이 핵심이다. 결제를 저장했는데 이벤트를
못 보내거나 그 반대가 되면, 모놀리스의 사본이 조용히 틀려도 아무도 모른다.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Final, Self, cast, final

import asyncpg

if TYPE_CHECKING:
    from collections.abc import Sequence
    from datetime import datetime, timedelta

SCHEMA: Final = """
create table if not exists tb_payment (
    id text primary key,
    order_id text not null,
    amount_cents int not null,
    status text not null,
    idempotency_key text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_payment_order on tb_payment (order_id);

create table if not exists tb_payment_outbox (
    id bigserial primary key,
    payment_id text not null,
    order_id text not null,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'NEW',
    created_at timestamptz not null default now(),
    claimed_at timestamptz,
    sent_at timestamptz
);

create index if not exists ix_payment_outbox_pending on tb_payment_outbox (status, created_at);
"""


@final
class PaymentRow:
    """결제 한 건. asyncpg.Record 를 그대로 흘리지 않으려고 감싼다."""

    __slots__ = ("amount_cents", "id", "occurred_at", "order_id", "status")

    def __init__(
        self,
        payment_id: str,
        order_id: str,
        amount_cents: int,
        status: str,
        occurred_at: datetime,
    ) -> None:
        """열 다섯을 그대로 받는다."""
        self.id = payment_id
        self.order_id = order_id
        self.amount_cents = amount_cents
        self.status = status
        # 이 사실이 '여기서' 일어난 시각이다. 받는 쪽이 순서를 판단하는 근거라 DB 시계를 쓴다.
        self.occurred_at = occurred_at

    @classmethod
    def of(cls, record: asyncpg.Record) -> Self:
        return cls(
            cast("str", record["id"]),
            cast("str", record["order_id"]),
            cast("int", record["amount_cents"]),
            cast("str", record["status"]),
            cast("datetime", record["updated_at"]),
        )


@final
class OutboxRow:
    """아직 안 보낸 이벤트 한 건."""

    __slots__ = ("event_id", "event_type", "order_id", "payload", "payment_id")

    def __init__(
        self,
        event_id: int,
        payment_id: str,
        order_id: str,
        event_type: str,
        payload: str,
    ) -> None:
        """아웃박스 한 행을 그대로 받는다."""
        self.event_id = event_id
        self.payment_id = payment_id
        self.order_id = order_id
        self.event_type = event_type
        self.payload = payload


@final
class PaymentRepository:
    """결제 저장과 아웃박스 기록. 둘은 반드시 한 트랜잭션이다."""

    def __init__(self, pool: asyncpg.Pool[asyncpg.Record]) -> None:
        """열린 풀을 받아 둔다."""
        self._pool = pool

    async def authorize(
        self,
        payment_id: str,
        order_id: str,
        amount_cents: int,
        idempotency_key: str,
    ) -> PaymentRow:
        """승인을 저장하고 같은 트랜잭션에 이벤트를 남긴다.

        같은 멱등키로 동시에 둘이 들어오면 하나는 유니크 제약에 걸린다. 예외로 올리지 않고
        on conflict do nothing 뒤에 재조회해서 먼저 만들어진 결제를 그대로 돌려준다.
        재조회 결과가 없을 수는 없다 — 제약에 걸렸다는 것은 행이 이미 있다는 뜻이다.
        """
        async with self._pool.acquire() as conn, conn.transaction():
            inserted = await conn.fetchrow(
                """
                insert into tb_payment (id, order_id, amount_cents, status, idempotency_key)
                values ($1, $2, $3, 'AUTHORIZED', $4)
                on conflict (idempotency_key) do nothing
                returning id, order_id, amount_cents, status, updated_at
                """,
                payment_id,
                order_id,
                amount_cents,
                idempotency_key,
            )
            if inserted is None:
                existing = await conn.fetchrow(
                    """
                    select id, order_id, amount_cents, status, updated_at
                    from tb_payment where idempotency_key = $1
                    """,
                    idempotency_key,
                )
                if existing is None:  # pragma: no cover - 제약에 걸렸으면 행이 있다
                    msg = f"idempotency conflict without row: {idempotency_key}"
                    raise RuntimeError(msg)
                return PaymentRow.of(existing)

            row = PaymentRow.of(inserted)
            await self._append_outbox(conn, row, "PAYMENT_AUTHORIZED")
            return row

    async def cancel(self, payment_id: str) -> PaymentRow | None:
        """취소도 이벤트를 낸다.

        승인에만 아웃박스를 붙이면 화면이 취소된 결제를 AUTHORIZED 로 계속 보여준다.
        조용히 틀리는 자리라 여기를 빼먹으면 안 된다.
        """
        async with self._pool.acquire() as conn, conn.transaction():
            updated = await conn.fetchrow(
                """
                update tb_payment set status = 'CANCELLED', updated_at = now()
                where id = $1
                returning id, order_id, amount_cents, status, updated_at
                """,
                payment_id,
            )
            if updated is None:
                return None

            row = PaymentRow.of(updated)
            await self._append_outbox(conn, row, "PAYMENT_CANCELLED")
            return row

    async def claim_pending(self, limit: int, claim_timeout: timedelta) -> Sequence[OutboxRow]:
        """보낼 이벤트를 선점한다.

        모놀리스의 KafkaDemoOutboxRelay 와 같은 두 규칙을 지킨다.
        선점을 for update skip locked 로 감싸 replica 가 둘일 때 중복 발행을 막고,
        Kafka 발행은 이 트랜잭션 밖에서 한다.

        선점해 놓고 끝내지 못한 행은 시간으로 회수한다. 되돌려 줄 주체가 죽었기 때문이다.

        claim_timeout 은 timedelta 이고 SQL 에는 ::interval 캐스트가 함께 필요하다. 둘 다여야 한다.
        문자열을 넘기면 asyncpg 가 DataError 를 내고, 캐스트를 빼면 postgres 가 $2 를
        timestamptz 로 추론해 now() - $2 가 interval 이 되면서 비교가 깨진다.
        """
        async with self._pool.acquire() as conn:
            records = await conn.fetch(
                """
                update tb_payment_outbox
                set status = 'CLAIMED', claimed_at = now()
                where id in (
                    select id from tb_payment_outbox
                    where status = 'NEW'
                       or (status = 'CLAIMED' and claimed_at < now() - $2::interval)
                    order by created_at
                    limit $1
                    for update skip locked
                )
                returning id, payment_id, order_id, event_type, payload::text as payload
                """,
                limit,
                claim_timeout,
            )
        return [
            OutboxRow(
                cast("int", r["id"]),
                cast("str", r["payment_id"]),
                cast("str", r["order_id"]),
                cast("str", r["event_type"]),
                cast("str", r["payload"]),
            )
            for r in records
        ]

    async def mark_sent(self, event_id: int) -> None:
        async with self._pool.acquire() as conn:
            _ = await conn.execute(
                "update tb_payment_outbox set status = 'SENT', sent_at = now() where id = $1",
                event_id,
            )

    async def release(self, event_id: int) -> None:
        """발행에 실패하면 NEW 로 되돌린다. 다음 주기가 다시 집는다."""
        async with self._pool.acquire() as conn:
            _ = await conn.execute(
                "update tb_payment_outbox set status = 'NEW', claimed_at = null where id = $1",
                event_id,
            )

    @staticmethod
    async def _append_outbox(
        conn: asyncpg.pool.PoolConnectionProxy[asyncpg.Record],
        row: PaymentRow,
        event_type: str,
    ) -> None:
        payload = json.dumps(
            {
                "paymentId": row.id,
                "orderId": row.order_id,
                "amountCents": row.amount_cents,
                "status": row.status,
                "eventType": event_type,
                "occurredAt": row.occurred_at.isoformat(),
            },
            ensure_ascii=False,
        )
        _ = await conn.execute(
            """
            insert into tb_payment_outbox (payment_id, order_id, event_type, payload)
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
