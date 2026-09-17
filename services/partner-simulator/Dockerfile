FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONPATH=/app/src
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src

ENV UV_CACHE_DIR=/tmp/uv-cache
USER 10001:10001
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "partner_simulator.main:app", "--host", "0.0.0.0", "--port", "8000"]
