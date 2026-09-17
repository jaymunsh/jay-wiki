# asyncpg.Pool 은 런타임에 첨자를 못 받는다. 3.12 는 애너테이션을 즉시 평가해서
# 이 줄이 없으면 import 하다 죽는다(3.14 는 PEP 649 라 늦게 평가돼 안 죽는다).
from __future__ import annotations

from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from os import getenv
from time import perf_counter
from typing import TYPE_CHECKING, ClassVar, Final, final
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response, status
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, ConfigDict, Field

from payment_api.db import PaymentRepository, open_pool
from payment_api.relay import RelayHandle, start_relay

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    import asyncpg

DEFAULT_DSN: Final = "postgresql://portfolio:changeme@127.0.0.1:5432/payment"

DEFAULT_SERVICE_NAME: Final = "jaywiki-payment-api"
OTLP_ENDPOINT_ENV: Final = "OTEL_EXPORTER_OTLP_ENDPOINT"
OTLP_TRACES_ENDPOINT_ENV: Final = "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"

AUTHORIZE_COUNTER: Final = Counter(
    "payment_authorize",
    "Payment authorization outcomes.",
    ["result"],
)
CANCEL_COUNTER: Final = Counter(
    "payment_cancel",
    "Payment cancellation outcomes.",
    ["result"],
)
REQUEST_SECONDS: Final = Histogram(
    "payment_request_seconds",
    "Payment participant operation duration.",
    ["operation", "result"],
)


class AuthorizeRequest(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, populate_by_name=True)

    order_id: str = Field(alias="orderId", min_length=1)
    amount_cents: int = Field(alias="amountCents", gt=0)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)
    fail: bool = False


class PaymentResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    payment_id: str = Field(alias="paymentId")
    status: str


@final
class PaymentService:
    """결제를 자기 DB 에 저장한다.

    전에는 dict 둘이었다. 그래서 파드가 재시작하면 그 전 주문의 취소가 404 로 깨졌다 —
    보상이 조용히 실패하던 자리다. DB 로 옮기면서 같이 사라진다.
    """

    __slots__: ClassVar[tuple[str, ...]] = ("_repo",)

    def __init__(self, repo: PaymentRepository) -> None:
        """저장소를 받아 둔다."""
        self._repo: PaymentRepository = repo

    async def authorize(self, request: AuthorizeRequest) -> PaymentResponse:
        started_at = perf_counter()
        result = "error"
        try:
            if request.fail:
                result = "failed"
                AUTHORIZE_COUNTER.labels("failed").inc()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="payment authorization failed",
                )

            row = await self._repo.authorize(
                "pay_" + uuid4().hex,
                request.order_id,
                request.amount_cents,
                request.idempotency_key,
            )
            result = "authorized"
            AUTHORIZE_COUNTER.labels("authorized").inc()
            return PaymentResponse(paymentId=row.id, status=row.status)
        finally:
            REQUEST_SECONDS.labels("authorize", result).observe(perf_counter() - started_at)

    async def cancel(self, payment_id: str) -> PaymentResponse:
        started_at = perf_counter()
        result = "error"
        try:
            row = await self._repo.cancel(payment_id)
            if row is None:
                result = "missing"
                CANCEL_COUNTER.labels("missing").inc()
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="payment not found",
                )

            result = "cancelled"
            CANCEL_COUNTER.labels("cancelled").inc()
            return PaymentResponse(paymentId=row.id, status=row.status)
        finally:
            REQUEST_SECONDS.labels("cancel", result).observe(perf_counter() - started_at)


def resolve_traces_endpoint(
    base_endpoint: str | None,
    explicit_endpoint: str | None,
) -> str | None:
    if explicit_endpoint is not None:
        return explicit_endpoint
    if base_endpoint is None:
        return None
    return base_endpoint.rstrip("/") + "/v1/traces"


def configure_tracing(fastapi_app: FastAPI) -> None:
    service_name = getenv("OTEL_SERVICE_NAME", DEFAULT_SERVICE_NAME)
    provider = TracerProvider(resource=Resource.create({SERVICE_NAME: service_name}))
    traces_endpoint = resolve_traces_endpoint(
        getenv(OTLP_ENDPOINT_ENV),
        getenv(OTLP_TRACES_ENDPOINT_ENV),
    )
    if traces_endpoint is not None:
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=traces_endpoint)))

    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(fastapi_app, tracer_provider=provider)


@final
class State:
    """풀과 서비스를 담는다. 모듈 전역 하나라 잠금이 필요 없다."""

    pool: asyncpg.Pool[asyncpg.Record] | None = None
    service: PaymentService | None = None
    relay: RelayHandle | None = None


def payments() -> PaymentService:
    if State.service is None:  # pragma: no cover - lifespan 이 항상 먼저 돈다
        msg = "payment service is not started"
        raise RuntimeError(msg)
    return State.service


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    State.pool = await open_pool(getenv("PAYMENT_DB_DSN", DEFAULT_DSN))
    repo = PaymentRepository(State.pool)
    State.service = PaymentService(repo)
    State.relay = await start_relay(repo)
    try:
        yield
    finally:
        if State.relay is not None:
            await State.relay.stop()
            State.relay = None
        await State.pool.close()
        State.pool = None
        State.service = None


app = FastAPI(
    title="jaywiki-payment-api",
    lifespan=lifespan,
)
configure_tracing(app)
_ = Instrumentator().instrument(app).expose(app)


# 미들웨어의 call_next 자리다. 이름을 붙여 두지 않으면 타입 검사가 걸린다.
ServedByNext = Callable[[Request], Awaitable[Response]]

# 어느 파드가 이 응답을 만들었는지 헤더로 알린다. Saga 화면이 단계마다 처리한 실물을 적는데,
# 응답 본문에 넣으면 엔드포인트마다 모델을 고쳐야 해서 헤더 한 자리로 둔다.
SERVED_BY: Final[str] = "payment-api@" + (getenv("HOSTNAME") or "local")


@app.middleware("http")
async def stamp_served_by(request: Request, call_next: ServedByNext) -> Response:
    """모든 응답에 처리한 서비스와 파드를 적는다."""
    response: Response = await call_next(request)
    response.headers["X-Served-By"] = SERVED_BY
    return response


@app.get("/health/live")
async def live() -> dict[str, str]:
    return {"status": "UP"}


@app.get("/health/ready")
async def ready() -> dict[str, str]:
    return {"status": "UP"}


@app.post("/payments/authorize", response_model_by_alias=True)
async def authorize(request: AuthorizeRequest) -> PaymentResponse:
    return await payments().authorize(request)


@app.post(
    "/payments/{payment_id}/cancel",
    response_model_by_alias=True,
)
async def cancel(payment_id: str) -> PaymentResponse:
    return await payments().cancel(payment_id)
