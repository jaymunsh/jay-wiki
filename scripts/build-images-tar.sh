#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT}/dist/images"
PLATFORM="${PLATFORM:-linux/amd64}"

mkdir -p "${OUT_DIR}"

docker buildx build --platform "${PLATFORM}" --load -t jaywiki-backend:local "${ROOT}/spring"
docker buildx build --platform "${PLATFORM}" --load -t jaywiki-web:local "${ROOT}/web"
docker buildx build --platform "${PLATFORM}" --load -t jaywiki-payment-api:local "${ROOT}/services/payment-api"
docker buildx build --platform "${PLATFORM}" --load -t jaywiki-shipping-api:local "${ROOT}/services/shipping-api"

docker save jaywiki-backend:local -o "${OUT_DIR}/jaywiki-backend.tar"
docker save jaywiki-web:local -o "${OUT_DIR}/jaywiki-web.tar"
docker save jaywiki-payment-api:local -o "${OUT_DIR}/jaywiki-payment-api.tar"
docker save jaywiki-shipping-api:local -o "${OUT_DIR}/jaywiki-shipping-api.tar"

echo "wrote ${OUT_DIR}/jaywiki-backend.tar"
echo "wrote ${OUT_DIR}/jaywiki-web.tar"
echo "wrote ${OUT_DIR}/jaywiki-payment-api.tar"
echo "wrote ${OUT_DIR}/jaywiki-shipping-api.tar"
