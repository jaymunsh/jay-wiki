import asyncio
import os
from typing import ClassVar, cast

import asyncpg
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from shipping_api.main import ShipmentResponse, resolve_traces_endpoint


class ErrorPayload(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    detail: str


def test_resolve_traces_endpoint_returns_none_when_otlp_is_disabled() -> None:
    endpoint = resolve_traces_endpoint(None, None)

    assert endpoint is None


def test_resolve_traces_endpoint_builds_trace_path_from_base_endpoint() -> None:
    endpoint = resolve_traces_endpoint("http://otel-collector:4318/", None)

    assert endpoint == "http://otel-collector:4318/v1/traces"


def test_request_returns_requested_shipment_when_request_is_valid(client: TestClient) -> None:
    response = client.post(
        "/shipments/request",
        json={"orderId": "ord_test", "idempotencyKey": "idem-test", "fail": False},
    )

    assert response.status_code == 200
    payload = ShipmentResponse.model_validate_json(response.text)
    assert payload.status == "REQUESTED"
    assert payload.shipment_id.startswith("ship_")


def test_request_returns_conflict_when_failure_is_injected(client: TestClient) -> None:
    response = client.post(
        "/shipments/request",
        json={"orderId": "ord_test", "idempotencyKey": "idem-fail", "fail": True},
    )

    assert response.status_code == 409
    payload = ErrorPayload.model_validate_json(response.text)
    assert payload.detail == "shipping request failed"


def test_request_accepts_snake_case_payload_from_internal_clients(client: TestClient) -> None:
    response = client.post(
        "/shipments/request",
        json={"order_id": "ord_snake", "idempotency_key": "idem-snake", "fail": False},
    )

    assert response.status_code == 200
    payload = ShipmentResponse.model_validate_json(response.text)
    assert payload.status == "REQUESTED"


def test_metrics_exposes_shipping_counters(client: TestClient) -> None:
    _ = client.post(
        "/shipments/request",
        json={"orderId": "ord_metrics", "idempotencyKey": "idem-metrics", "fail": False},
    )

    response = client.get("/metrics")

    assert response.status_code == 200
    assert "shipping_request_total" in response.text


def test_request_writes_outbox_in_the_same_transaction(client: TestClient) -> None:
    created = client.post(
        "/shipments/request",
        json={"orderId": "ord_outbox", "idempotencyKey": "idem-outbox", "fail": False},
    )
    shipment_id = ShipmentResponse.model_validate_json(created.text).shipment_id

    # 이벤트가 안 나가면 모놀리스의 사본이 NONE 으로 남고 화면이 배송을 못 본다.
    assert _outbox_events(shipment_id) == ["SHIPPING_REQUESTED"]


def test_failed_request_leaves_nothing_behind(client: TestClient) -> None:
    _ = client.post(
        "/shipments/request",
        json={"orderId": "ord_none", "idempotencyKey": "idem-none", "fail": True},
    )

    # 실패 주입은 행도 이벤트도 남기지 않는다. 남기면 보상 뒤에도 화면에 배송이 뜬다.
    assert _all_orders() == []


def test_same_idempotency_key_returns_the_first_shipment(client: TestClient) -> None:
    body = {"orderId": "ord_idem", "idempotencyKey": "idem-twice", "fail": False}
    first = ShipmentResponse.model_validate_json(client.post("/shipments/request", json=body).text)
    second = ShipmentResponse.model_validate_json(client.post("/shipments/request", json=body).text)

    assert first.shipment_id == second.shipment_id
    # 두 번째는 새 이벤트를 내지 않는다. 냈으면 모놀리스가 같은 사실을 두 번 받는다.
    assert _outbox_events(first.shipment_id) == ["SHIPPING_REQUESTED"]


def _outbox_events(shipment_id: str) -> list[str]:
    async def run() -> list[str]:
        conn = await asyncpg.connect(os.environ["SHIPPING_DB_DSN"])
        try:
            rows = await conn.fetch(
                "select event_type from tb_shipping_outbox where shipment_id = $1 order by id",
                shipment_id,
            )
            return [cast("str", r["event_type"]) for r in rows]
        finally:
            await conn.close()

    return asyncio.run(run())


def _all_orders() -> list[str]:
    async def run() -> list[str]:
        conn = await asyncpg.connect(os.environ["SHIPPING_DB_DSN"])
        try:
            rows = await conn.fetch("select order_id from tb_shipping")
            return [cast("str", r["order_id"]) for r in rows]
        finally:
            await conn.close()

    return asyncio.run(run())
