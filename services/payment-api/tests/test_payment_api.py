import asyncio
import os
from typing import ClassVar, cast

import asyncpg
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from payment_api.main import PaymentResponse, resolve_traces_endpoint


class ErrorPayload(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    detail: str


def test_resolve_traces_endpoint_returns_none_when_otlp_is_disabled() -> None:
    endpoint = resolve_traces_endpoint(None, None)

    assert endpoint is None


def test_resolve_traces_endpoint_builds_trace_path_from_base_endpoint() -> None:
    endpoint = resolve_traces_endpoint("http://otel-collector:4318/", None)

    assert endpoint == "http://otel-collector:4318/v1/traces"


def test_resolve_traces_endpoint_prefers_explicit_trace_endpoint() -> None:
    endpoint = resolve_traces_endpoint(
        "http://otel-collector:4318",
        "http://tempo:4318/v1/traces",
    )

    assert endpoint == "http://tempo:4318/v1/traces"


def test_authorize_returns_authorized_payment_when_request_is_valid(client: TestClient) -> None:
    response = client.post(
        "/payments/authorize",
        json={
            "orderId": "ord_test",
            "amountCents": 49000,
            "idempotencyKey": "idem-test",
            "fail": False,
        },
    )

    assert response.status_code == 200
    payload = PaymentResponse.model_validate_json(response.text)
    assert payload.status == "AUTHORIZED"
    assert payload.payment_id.startswith("pay_")


def test_authorize_returns_conflict_when_failure_is_injected(client: TestClient) -> None:
    response = client.post(
        "/payments/authorize",
        json={
            "orderId": "ord_test",
            "amountCents": 49000,
            "idempotencyKey": "idem-fail",
            "fail": True,
        },
    )

    assert response.status_code == 409
    payload = ErrorPayload.model_validate_json(response.text)
    assert payload.detail == "payment authorization failed"


def test_authorize_accepts_snake_case_payload_from_internal_clients(client: TestClient) -> None:
    response = client.post(
        "/payments/authorize",
        json={
            "order_id": "ord_snake",
            "amount_cents": 49000,
            "idempotency_key": "idem-snake",
            "fail": False,
        },
    )

    assert response.status_code == 200
    payload = PaymentResponse.model_validate_json(response.text)
    assert payload.status == "AUTHORIZED"


def test_cancel_returns_cancelled_payment_when_authorization_exists(client: TestClient) -> None:
    created = client.post(
        "/payments/authorize",
        json={
            "orderId": "ord_cancel",
            "amountCents": 49000,
            "idempotencyKey": "idem-cancel",
            "fail": False,
        },
    )
    created_payload = PaymentResponse.model_validate_json(created.text)
    payment_id = created_payload.payment_id

    response = client.post(f"/payments/{payment_id}/cancel")

    assert response.status_code == 200
    payload = PaymentResponse.model_validate_json(response.text)
    assert payload.payment_id == payment_id
    assert payload.status == "CANCELLED"


def test_metrics_exposes_payment_counters(client: TestClient) -> None:
    _ = client.post(
        "/payments/authorize",
        json={
            "orderId": "ord_metrics",
            "amountCents": 49000,
            "idempotencyKey": "idem-metrics",
            "fail": False,
        },
    )

    response = client.get("/metrics")

    assert response.status_code == 200
    assert "payment_authorize_total" in response.text


def test_authorize_writes_outbox_in_the_same_transaction(client: TestClient) -> None:
    created = client.post(
        "/payments/authorize",
        json={
            "orderId": "ord_outbox",
            "amountCents": 49000,
            "idempotencyKey": "idem-outbox",
            "fail": False,
        },
    )
    payment_id = PaymentResponse.model_validate_json(created.text).payment_id

    _ = client.post(f"/payments/{payment_id}/cancel")

    # 승인에만 아웃박스를 붙이면 화면이 취소된 결제를 AUTHORIZED 로 계속 보여준다.
    assert _outbox_events(payment_id) == ["PAYMENT_AUTHORIZED", "PAYMENT_CANCELLED"]


def test_same_idempotency_key_returns_the_first_payment(client: TestClient) -> None:
    body = {
        "orderId": "ord_idem",
        "amountCents": 49000,
        "idempotencyKey": "idem-twice",
        "fail": False,
    }
    first = PaymentResponse.model_validate_json(client.post("/payments/authorize", json=body).text)
    second = PaymentResponse.model_validate_json(client.post("/payments/authorize", json=body).text)

    assert first.payment_id == second.payment_id
    # 두 번째는 새 이벤트를 내지 않는다. 냈으면 모놀리스가 같은 사실을 두 번 받는다.
    assert _outbox_events(first.payment_id) == ["PAYMENT_AUTHORIZED"]


def _outbox_events(payment_id: str) -> list[str]:
    async def run() -> list[str]:
        conn = await asyncpg.connect(os.environ["PAYMENT_DB_DSN"])
        try:
            rows = await conn.fetch(
                "select event_type from tb_payment_outbox where payment_id = $1 order by id",
                payment_id,
            )
            return [cast("str", r["event_type"]) for r in rows]
        finally:
            await conn.close()

    return asyncio.run(run())
