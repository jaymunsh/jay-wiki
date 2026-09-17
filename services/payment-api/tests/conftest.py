"""테스트용 결제 DB.

dict 였을 때는 필요 없던 것이다. 자기 데이터를 들기로 한 순간 테스트도 DB 를 요구한다 —
분리의 값에는 이런 것도 들어간다.

DSN 은 PAYMENT_DB_DSN 으로 바꿀 수 있다. CI 는 서비스 컨테이너 주소를 넣는다.
"""

import asyncio
import os
from collections.abc import Iterator
from typing import Final

import asyncpg
import pytest
from fastapi.testclient import TestClient

from payment_api.main import app

DEFAULT_TEST_DSN: Final = "postgresql://portfolio:changeme@127.0.0.1:5432/payment_test"


@pytest.fixture
def client() -> Iterator[TestClient]:
    """lifespan 을 실제로 돌린다. with 없이 TestClient 를 쓰면 풀이 안 열린다."""
    _ = os.environ.setdefault("PAYMENT_DB_DSN", DEFAULT_TEST_DSN)
    with TestClient(app) as started:
        _truncate()
        yield started


def _truncate() -> None:
    async def run() -> None:
        conn = await asyncpg.connect(os.environ["PAYMENT_DB_DSN"])
        try:
            _ = await conn.execute("truncate tb_payment, tb_payment_outbox")
        finally:
            await conn.close()

    asyncio.run(run())
