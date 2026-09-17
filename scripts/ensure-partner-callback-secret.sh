#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-backend}"
SECRET_NAME="${SECRET_NAME:-jaywiki-secrets}"
SECRET_KEY="APP_PARTNER_CALLBACK_SECRET"

current="$(kubectl -n "${NAMESPACE}" get secret "${SECRET_NAME}" \
  -o "jsonpath={.data.${SECRET_KEY}}" 2>/dev/null || true)"
if [ -n "${current}" ]; then
  echo "partner callback secret already exists"
  exit 0
fi

value="$(openssl rand -hex 32 | base64 | tr -d '\n')"
patch="$(printf '{\"data\":{\"%s\":\"%s\"}}' "${SECRET_KEY}" "${value}")"
kubectl -n "${NAMESPACE}" patch secret "${SECRET_NAME}" --type merge -p "${patch}" >/dev/null
echo "partner callback secret created"
