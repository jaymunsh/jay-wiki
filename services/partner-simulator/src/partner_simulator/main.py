from dataclasses import dataclass, field
from enum import StrEnum
from hashlib import sha256
from hmac import new as new_hmac
from os import getenv
from time import time
from typing import ClassVar, Final

import anyio
import httpx2
from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field

CALLBACK_SECRET: Final = getenv("PARTNER_CALLBACK_SECRET", "local-partner-secret")
SIMULATOR_HEADER: Final = {"X-Partner-Simulator": "jaywiki"}


class ScenarioMode(StrEnum):
    NORMAL = "NORMAL"
    TIMEOUT_CALLBACK = "TIMEOUT_CALLBACK"
    RATE_LIMIT = "RATE_LIMIT"
    SERVER_ERROR = "SERVER_ERROR"
    BAD_SIGNATURE = "BAD_SIGNATURE"


class SignatureMode(StrEnum):
    VALID = "VALID"
    INVALID = "INVALID"


class ApprovalRequest(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, populate_by_name=True)

    correlation_id: str = Field(alias="correlationId", min_length=1)
    callback_url: str = Field(alias="callbackUrl", min_length=1)


class ApprovalResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    correlation_id: str = Field(alias="correlationId")
    status: str


class CallbackPayload(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, serialize_by_alias=True)

    correlation_id: str = Field(alias="correlationId")
    status: str
    timestamp: int


@dataclass(slots=True)
class AttemptStore:
    """Mutable request counter used only to reproduce a 429-then-success partner policy."""

    attempts: dict[str, int] = field(default_factory=dict)

    def increment(self, correlation_id: str) -> int:
        next_attempt = self.attempts.get(correlation_id, 0) + 1
        self.attempts[correlation_id] = next_attempt
        return next_attempt


attempt_store: Final = AttemptStore()
app = FastAPI(title="jaywiki-partner-simulator")


def sign_callback(payload: str, secret: str) -> str:
    return new_hmac(secret.encode(), payload.encode(), sha256).hexdigest()


async def send_callback(request: ApprovalRequest, signature_mode: SignatureMode) -> None:
    await anyio.sleep(1.0)
    payload = CallbackPayload(
        correlationId=request.correlation_id,
        status="APPROVED",
        timestamp=int(time()),
    ).model_dump_json(by_alias=True)
    match signature_mode:
        case SignatureMode.VALID:
            signature = sign_callback(payload, CALLBACK_SECRET)
        case SignatureMode.INVALID:
            signature = "invalid-signature"
    timeout = httpx2.Timeout(connect=2.0, read=2.0, write=2.0, pool=2.0)
    limits = httpx2.Limits(max_connections=10, max_keepalive_connections=5)
    transport = httpx2.AsyncHTTPTransport(http2=True, retries=1, limits=limits)
    async with httpx2.AsyncClient(transport=transport, timeout=timeout) as client:
        _ = await client.post(
            request.callback_url,
            content=payload,
            headers={"content-type": "application/json", "X-Partner-Signature": signature},
        )


@app.get("/health/ready")
async def ready() -> dict[str, str]:
    return {"status": "UP"}


@app.post("/partner/approve", response_model_by_alias=True)
async def approve(
    request: ApprovalRequest,
    mode: ScenarioMode,
    response: Response,
) -> ApprovalResponse:
    response.headers.update(SIMULATOR_HEADER)
    match mode:
        case ScenarioMode.NORMAL:
            return ApprovalResponse(correlationId=request.correlation_id, status="APPROVED")
        case ScenarioMode.TIMEOUT_CALLBACK:
            async with anyio.create_task_group() as tasks:
                _ = tasks.start_soon(send_callback, request, SignatureMode.VALID)
                await anyio.sleep(2.5)
            return ApprovalResponse(correlationId=request.correlation_id, status="APPROVED")
        case ScenarioMode.RATE_LIMIT:
            if attempt_store.increment(request.correlation_id) == 1:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="partner rate limit",
                    headers={"Retry-After": "1", **SIMULATOR_HEADER},
                )
            return ApprovalResponse(correlationId=request.correlation_id, status="APPROVED")
        case ScenarioMode.SERVER_ERROR:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="partner internal error",
                headers=SIMULATOR_HEADER,
            )
        case ScenarioMode.BAD_SIGNATURE:
            await send_callback(request, SignatureMode.INVALID)
            return ApprovalResponse(correlationId=request.correlation_id, status="CALLBACK_SENT")
