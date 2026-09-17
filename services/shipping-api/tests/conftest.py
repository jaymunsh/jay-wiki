"""테스트용 배송 DB.

DSN 은 SHIPPING_DB_DSN 으로 바꿀 수 있다. CI 는 서비스 컨테이너 주소를 넣는다
(payment-api 와 같은 postgres 인스턴스의 다른 DB 다 -- .github/workflows/deploy.yml).
"""

import asyncio
import os
from collections.abc import Iterator
from typing import Final

import asyncpg
import pytest
from fastapi.testclient import TestClient

from shipping_api.main import app

DEFAULT_TEST_DSN: Final = "postgresql://portfolio:changeme@127.0.0.1:5432/shipping_test"


@pytest.fixture
def client() -> Iterator[TestClient]:
    """lifespan 을 실제로 돌린다. with 없이 TestClient 를 쓰면 풀이 안 열린다."""
    _ = os.environ.setdefault("SHIPPING_DB_DSN", DEFAULT_TEST_DSN)
    with TestClient(app) as started:
        _truncate()
        yield started


def _truncate() -> None:
    async def run() -> None:
        conn = await asyncpg.connect(os.environ["SHIPPING_DB_DSN"])
        try:
            _ = await conn.execute("truncate tb_shipping, tb_shipping_outbox")
        finally:
            await conn.close()

    asyncio.run(run())
