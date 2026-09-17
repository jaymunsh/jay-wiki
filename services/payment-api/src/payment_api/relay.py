"""아웃박스를 Kafka 로 내보내는 릴레이.

모놀리스의 KafkaDemoOutboxRelay 를 파이썬으로 옮긴 것이다. 규칙 둘을 그대로 지킨다.

1. 선점을 `for update skip locked` 로 감싼다. replica 가 둘이면 같은 행을 둘 다 집어 중복 발행한다.
2. 발행은 선점 트랜잭션 **밖**에서 한다. Kafka send 를 기다리는 동안
   행 잠금과 커넥션을 쥐고 있으면 안 된다.

여기서 Kafka 가 처음으로 프로세스를 건넌다. 그 전까지는 모놀리스가 자기한테 보내고
자기가 받고 있었다 — 구현이 아니라 배치가 놀던 것이다.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import timedelta
from os import getenv
from typing import TYPE_CHECKING, Final, Protocol, final

from aiokafka import AIOKafkaProducer

if TYPE_CHECKING:
    from payment_api.db import PaymentRepository

LOGGER: Final = logging.getLogger(__name__)

DEFAULT_TOPIC: Final = "jaywiki.payment-events"
DEFAULT_BOOTSTRAP: Final = "127.0.0.1:9092"
DEFAULT_DELAY_SECONDS: Final = 2.0
CLAIM_LIMIT: Final = 10
# 발행 대기 상한보다 넉넉히 잡는다. 이보다 오래 CLAIMED 면 선점자가 죽은 것으로 본다.
CLAIM_TIMEOUT: Final = timedelta(seconds=60)


class Publisher(Protocol):
    """Kafka 발행자. 테스트는 가짜를 끼운다 — 릴레이 로직을 브로커 없이 검증하려고."""

    async def send(self, topic: str, key: str, value: str) -> None: ...


@final
class KafkaPublisher:
    """aiokafka 생산자를 감싼다. 브로커가 없으면 시작 자체가 실패한다."""

    def __init__(self, bootstrap: str) -> None:
        """부트스트랩 주소만 받아 둔다. 연결은 start() 에서 한다."""
        self._bootstrap: str = bootstrap
        self._producer: AIOKafkaProducer | None = None

    async def start(self) -> None:
        producer = AIOKafkaProducer(bootstrap_servers=self._bootstrap)
        try:
            await producer.start()
        except Exception:
            # 못 붙었어도 닫아 준다. 그냥 두면 GC 가 부르는 __del__ 이 나중에 예외를 낸다 --
            # 브로커가 없는 것은 이 서비스가 견디기로 한 상황이라 흔적을 남기면 안 된다.
            await producer.stop()
            raise
        self._producer = producer

    async def stop(self) -> None:
        if self._producer is not None:
            await self._producer.stop()
        self._producer = None

    async def send(self, topic: str, key: str, value: str) -> None:
        if self._producer is None:
            msg = "kafka producer is not started"
            raise RuntimeError(msg)
        _ = await self._producer.send_and_wait(topic, value.encode(), key=key.encode())


async def drain_once(repo: PaymentRepository, publisher: Publisher, topic: str) -> int:
    """선점한 만큼 발행한다. 보낸 건수를 돌려준다.

    한 건이 실패해도 나머지는 계속 보낸다. 실패한 건은 NEW 로 되돌려 다음 주기가 다시 집는다.
    되돌리지 않으면 CLAIM_TIMEOUT 이 지날 때까지 그 이벤트만 멈춘다.
    """
    sent = 0
    for row in await repo.claim_pending(CLAIM_LIMIT, CLAIM_TIMEOUT):
        try:
            await publisher.send(topic, row.order_id, row.payload)
        except Exception:
            LOGGER.exception("payment outbox publish failed: id=%s", row.event_id)
            await repo.release(row.event_id)
        else:
            await repo.mark_sent(row.event_id)
            sent += 1
    return sent


async def run_forever(
    repo: PaymentRepository,
    publisher: Publisher,
    topic: str,
    delay_seconds: float,
) -> None:
    """주기적으로 비운다.

    한 주기의 실패가 릴레이를 죽이면 안 된다. 브로커가 잠깐 없어도 다음 주기에 다시 붙는다.
    """
    while True:
        try:
            _ = await drain_once(repo, publisher, topic)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOGGER.exception("payment outbox relay cycle failed")
        await asyncio.sleep(delay_seconds)


@final
class RelayHandle:
    """켜고 끄는 손잡이. lifespan 이 든다."""

    def __init__(self, task: asyncio.Task[None], publisher: KafkaPublisher) -> None:
        """돌고 있는 태스크와 생산자를 받아 둔다."""
        self._task: asyncio.Task[None] = task
        self._publisher: KafkaPublisher = publisher

    async def stop(self) -> None:
        _ = self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        await self._publisher.stop()


async def start_relay(repo: PaymentRepository) -> RelayHandle | None:
    """릴레이를 띄운다. 브로커에 못 붙으면 None 을 돌려주고 결제 API 는 계속 뜬다.

    결제 승인은 Kafka 없이도 돼야 한다. 아웃박스에 쌓여 있다가 브로커가 살아나면 나간다 —
    그러라고 아웃박스를 쓰는 것이다.
    """
    if getenv("PAYMENT_RELAY_ENABLED", "true").lower() != "true":
        return None

    publisher = KafkaPublisher(getenv("PAYMENT_KAFKA_BOOTSTRAP", DEFAULT_BOOTSTRAP))
    try:
        await publisher.start()
    except Exception:
        LOGGER.exception("payment outbox relay could not reach kafka; api keeps serving")
        return None

    topic = getenv("PAYMENT_KAFKA_TOPIC", DEFAULT_TOPIC)
    delay = float(getenv("PAYMENT_RELAY_DELAY_SECONDS", str(DEFAULT_DELAY_SECONDS)))
    task = asyncio.create_task(run_forever(repo, publisher, topic, delay))
    return RelayHandle(task, publisher)
