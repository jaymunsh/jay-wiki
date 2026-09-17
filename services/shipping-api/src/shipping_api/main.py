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

from shipping_api.db import ShippingRepository, open_pool
from shipping_api.relay import RelayHandle, start_relay

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    import asyncpg

DEFAULT_DSN: Final = "postgresql://portfolio:changeme@127.0.0.1:5432/shipping"

DEFAULT_SERVICE_NAME: Final = "jaywiki-shipping-api"
OTLP_ENDPOINT_ENV: Final = "OTEL_EXPORTER_OTLP_ENDPOINT"
OTLP_TRACES_ENDPOINT_ENV: Final = "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"

REQUEST_COUNTER: Final = Counter(
    "shipping_request",
    "Shipping request outcomes.",
    ["result"],
)
REQUEST_SECONDS: Final = Histogram(
    "shipping_request_seconds",
    "Shipping participant operation duration.",
    ["operation", "result"],
)


class ShipmentRequest(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, populate_by_name=True)

    order_id: str = Field(alias="orderId", min_length=1)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)
    fail: bool = False


class ShipmentResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    shipment_id: str = Field(alias="shipmentId")
    status: str


@final
class ShippingService:
    """배송 접수를 자기 DB 에 저장한다.

    전에는 모놀리스가 tb_saga_shipping 에 row 하나를 넣는 로컬 코드였다. 자를 로직이 없어서
    가장 싸게 두 번째 사례를 얻는 자리이기도 하다 -- 여기서 바뀌는 것은 코드가 아니라 소유권이다.
    """

    __slots__: ClassVar[tuple[str, ...]] = ("_repo",)

    def __init__(self, repo: ShippingRepository) -> None:
        """저장소를 받아 둔다."""
        self._repo: ShippingRepository = repo

    async def request(self, request: ShipmentRequest) -> ShipmentResponse:
        started_at = perf_counter()
        result = "error"
        try:
            if request.fail:
                result = "failed"
                REQUEST_COUNTER.labels("failed").inc()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="shipping request failed",
                )

            row = await self._repo.request(
                "ship_" + uuid4().hex,
                request.order_id,
                request.idempotency_key,
            )
            result = "requested"
            REQUEST_COUNTER.labels("requested").inc()
            return ShipmentResponse(shipmentId=row.id, status=row.status)
        finally:
            REQUEST_SECONDS.labels("request", result).observe(perf_counter() - started_at)


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
    service: ShippingService | None = None
    relay: RelayHandle | None = None


def shipments() -> ShippingService:
    if State.service is None:  # pragma: no cover - lifespan 이 항상 먼저 돈다
        msg = "shipping service is not started"
        raise RuntimeError(msg)
    return State.service


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    State.pool = await open_pool(getenv("SHIPPING_DB_DSN", DEFAULT_DSN))
    repo = ShippingRepository(State.pool)
    State.service = ShippingService(repo)
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
    title="jaywiki-shipping-api",
    lifespan=lifespan,
)
configure_tracing(app)
_ = Instrumentator().instrument(app).expose(app)


# 미들웨어의 call_next 자리다. 이름을 붙여 두지 않으면 타입 검사가 걸린다.
ServedByNext = Callable[[Request], Awaitable[Response]]

# 어느 파드가 이 응답을 만들었는지 헤더로 알린다. Saga 화면이 단계마다 처리한 실물을 적는데,
# 응답 본문에 넣으면 엔드포인트마다 모델을 고쳐야 해서 헤더 한 자리로 둔다.
SERVED_BY: Final[str] = "shipping-api@" + (getenv("HOSTNAME") or "local")


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


@app.post("/shipments/request", response_model_by_alias=True)
async def request_shipment(request: ShipmentRequest) -> ShipmentResponse:
    return await shipments().request(request)
