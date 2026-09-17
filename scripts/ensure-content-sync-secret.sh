#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-backend}"
SECRET_NAME="${SECRET_NAME:-jaywiki-secrets}"
SECRET_KEY="APP_CONTENT_SYNC_TOKEN"

current="$(kubectl -n "${NAMESPACE}" get secret "${SECRET_NAME}" \
  -o "jsonpath={.data.${SECRET_KEY}}" 2>/dev/null || true)"
if [[ -n "${current}" ]]; then
  echo "content sync secret already exists"
  exit 0
fi

raw_value="$(openssl rand -hex 32)"
encoded_value="$(printf '%s' "${raw_value}" | base64 | tr -d '\n')"
patch="$(printf '{\"data\":{\"%s\":\"%s\"}}' "${SECRET_KEY}" "${encoded_value}")"
kubectl -n "${NAMESPACE}" patch secret "${SECRET_NAME}" --type merge -p "${patch}" >/dev/null
unset raw_value encoded_value patch
echo "content sync secret created"
