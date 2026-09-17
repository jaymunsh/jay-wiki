from fastapi.testclient import TestClient

from partner_simulator.main import app, sign_callback

client = TestClient(app)


def request_payload(correlation_id: str) -> dict[str, str]:
    return {
        "correlationId": correlation_id,
        "callbackUrl": "http://127.0.0.1:8080/api/domain-scenarios/partner-api/callbacks",
    }


def test_normal_returns_real_approval_response() -> None:
    response = client.post(
        "/partner/approve",
        params={"mode": "NORMAL"},
        json=request_payload("corr-normal"),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"
    assert response.headers["X-Partner-Simulator"] == "jaywiki"


def test_rate_limit_returns_429_then_succeeds_for_same_correlation_id() -> None:
    payload = request_payload("corr-rate-limit")

    first = client.post("/partner/approve", params={"mode": "RATE_LIMIT"}, json=payload)
    second = client.post("/partner/approve", params={"mode": "RATE_LIMIT"}, json=payload)

    assert first.status_code == 429
    assert first.headers["Retry-After"] == "1"
    assert second.status_code == 200
    assert second.json()["status"] == "APPROVED"


def test_server_error_always_returns_500() -> None:
    response = client.post(
        "/partner/approve",
        params={"mode": "SERVER_ERROR"},
        json=request_payload("corr-server-error"),
    )

    assert response.status_code == 500


def test_callback_signature_is_stable_for_same_payload() -> None:
    payload = '{"correlationId":"corr-sign","status":"APPROVED","timestamp":1234}'

    first = sign_callback(payload, "local-partner-secret")
    second = sign_callback(payload, "local-partner-secret")

    assert first == second
    assert len(first) == 64
