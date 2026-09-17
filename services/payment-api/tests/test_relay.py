# asyncpg.Pool 은 런타임에 첨자를 못 받는다. 3.12 는 애너테이션을 즉시 평가해서
# 이 줄이 없으면 import 하다 죽는다(3.14 는 PEP 649 라 늦게 평가돼 안 죽는다).
from __future__ import annotations

import asyncio
import gc
import os
from datetime import timedelta
from typing import TYPE_CHECKING, Final

import pytest

from payment_api.db import PaymentRepository, open_pool
from payment_api.relay import drain_once, start_relay

if TYPE_CHECKING:
    import asyncpg

TOPIC: Final = "test.payment-events"


class RecordingPublisher:
    """보낸 것을 기억한다. 브로커 없이 릴레이 로직만 본다."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    async def send(self, topic: str, key: str, value: str) -> None:
        _ = topic
        self.sent.append((key, value))


class FailingPublisher:
    """항상 실패한다. 실패한 이벤트가 되돌아오는지 보려고."""

    async def send(self, topic: str, key: str, value: str) -> None:
        _ = (topic, key, value)
        msg = "broker down"
        raise RuntimeError(msg)


def _dsn() -> str:
    return os.environ.setdefault(
        "PAYMENT_DB_DSN",
        "postgresql://portfolio:changeme@127.0.0.1:5432/payment_test",
    )


async def _fresh_repo() -> tuple[PaymentRepository, asyncpg.Pool[asyncpg.Record]]:
    pool = await open_pool(_dsn())
    async with pool.acquire() as conn:
        _ = await conn.execute("truncate tb_payment, tb_payment_outbox")
    return PaymentRepository(pool), pool


def test_drain_sends_pending_events_and_marks_them_sent() -> None:
    async def run() -> None:
        repo, pool = await _fresh_repo()
        try:
            _ = await repo.authorize("pay_relay1", "ord_relay1", 49000, "idem-relay1")
            publisher = RecordingPublisher()

            sent = await drain_once(repo, publisher, TOPIC)

            assert sent == 1
            # 키는 order_id 다. 같은 주문의 이벤트가 같은 파티션으로 가야 순서가 지켜진다.
            assert publisher.sent[0][0] == "ord_relay1"
            assert '"status": "AUTHORIZED"' in publisher.sent[0][1]
            # 받는 쪽이 순서를 판단하려면 원본 시각이 있어야 한다. 이벤트가 늦게 와도
            # 과거 상태로 되돌아가지 않게 하는 근거다.
            assert '"occurredAt"' in publisher.sent[0][1]
            # 두 번째 주기는 보낼 것이 없다. 안 그러면 모놀리스가 같은 사실을 반복해서 받는다.
            assert await drain_once(repo, publisher, TOPIC) == 0
        finally:
            await pool.close()

    asyncio.run(run())


def test_failed_publish_returns_the_event_so_the_next_cycle_retries() -> None:
    async def run() -> None:
        repo, pool = await _fresh_repo()
        try:
            _ = await repo.authorize("pay_relay2", "ord_relay2", 49000, "idem-relay2")

            assert await drain_once(repo, FailingPublisher(), TOPIC) == 0

            # NEW 로 되돌아와야 한다. 안 되돌리면 선점 타임아웃(60초)까지 그 이벤트만 멈춘다.
            recovered = RecordingPublisher()
            assert await drain_once(repo, recovered, TOPIC) == 1
        finally:
            await pool.close()

    asyncio.run(run())


def test_cancel_event_is_relayed_too() -> None:
    async def run() -> None:
        repo, pool = await _fresh_repo()
        try:
            _ = await repo.authorize("pay_relay3", "ord_relay3", 49000, "idem-relay3")
            _ = await repo.cancel("pay_relay3")
            publisher = RecordingPublisher()

            assert await drain_once(repo, publisher, TOPIC) == 2
            # 취소가 안 나가면 화면이 취소된 결제를 AUTHORIZED 로 계속 보여준다.
            assert '"status": "CANCELLED"' in publisher.sent[1][1]
        finally:
            await pool.close()

    asyncio.run(run())


def test_cancelling_a_missing_payment_produces_no_event() -> None:
    async def run() -> None:
        repo, pool = await _fresh_repo()
        try:
            assert await repo.cancel("pay_nope") is None
            assert await drain_once(repo, RecordingPublisher(), TOPIC) == 0
        finally:
            await pool.close()

    asyncio.run(run())


@pytest.mark.parametrize("limit", [1, 10])
def test_claim_respects_the_limit(limit: int) -> None:
    async def run() -> None:
        repo, pool = await _fresh_repo()
        try:
            for n in range(3):
                _ = await repo.authorize(f"pay_lim{n}", f"ord_lim{n}", 49000, f"idem-lim{n}")

            claimed = await repo.claim_pending(limit, timedelta(seconds=60))

            assert len(claimed) == min(limit, 3)
        finally:
            await pool.close()

    asyncio.run(run())


def test_relay_gives_up_cleanly_when_the_broker_is_missing() -> None:
    """브로커가 없으면 None 을 주고, 생산자를 남기지 않는다.

    닫지 않은 AIOKafkaProducer 는 나중에 __del__ 에서 예외를 내고, pytest 는 그것을
    에러로 올린다. CI 에 브로커가 없어서 실제로 그렇게 났다.
    """

    async def run() -> None:
        repo, pool = await _fresh_repo()
        try:
            os.environ["PAYMENT_KAFKA_BOOTSTRAP"] = "127.0.0.1:1"
            assert await start_relay(repo) is None
        finally:
            del os.environ["PAYMENT_KAFKA_BOOTSTRAP"]
            await pool.close()

    asyncio.run(run())
    _ = gc.collect()
