from collections.abc import Callable, Sequence
from typing import Literal

from fastapi import FastAPI
from opentelemetry.metrics import MeterProvider
from opentelemetry.sdk.trace import TracerProvider

type Scope = dict[str, str]
type Message = dict[str, str]
type ServerRequestHook = Callable[[object, Scope], None]
type ClientRequestHook = Callable[[object, Scope, Message], None]
type ClientResponseHook = Callable[[object, Scope, Message], None]


class FastAPIInstrumentor:
    @staticmethod
    def instrument_app(
        app: FastAPI,
        server_request_hook: ServerRequestHook | None = ...,
        client_request_hook: ClientRequestHook | None = ...,
        client_response_hook: ClientResponseHook | None = ...,
        tracer_provider: TracerProvider | None = ...,
        meter_provider: MeterProvider | None = ...,
        excluded_urls: str | None = ...,
        http_capture_headers_server_request: Sequence[str] | None = ...,
        http_capture_headers_server_response: Sequence[str] | None = ...,
        http_capture_headers_sanitize_fields: Sequence[str] | None = ...,
        exclude_spans: Sequence[Literal["receive", "send"]] | None = ...,
    ) -> None: ...
