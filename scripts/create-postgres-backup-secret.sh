#!/usr/bin/env bash
set -euo pipefail

SECRET_FILE="${SECRET_FILE:-$HOME/.jaywiki/prod-secrets.env}"
REMOTE_HOST="${REMOTE_HOST:-}"

if [[ ! -f "${SECRET_FILE}" ]]; then
  echo "Secret file not found: ${SECRET_FILE}" >&2
  exit 1
fi

SPRING_DATASOURCE_PASSWORD="$(
  grep '^SPRING_DATASOURCE_PASSWORD=' "${SECRET_FILE}" | tail -1 | cut -d= -f2-
)"

if [[ -z "${SPRING_DATASOURCE_PASSWORD}" ]]; then
  echo "SPRING_DATASOURCE_PASSWORD is missing in ${SECRET_FILE}" >&2
  exit 1
fi

kubectl -n data create secret generic jaywiki-db-backup \
  --from-literal=PGPASSWORD="${SPRING_DATASOURCE_PASSWORD}" \
  --dry-run=client -o yaml | if [[ -n "${REMOTE_HOST}" ]]; then
    ssh "${REMOTE_HOST}" 'kubectl apply -f -'
  else
    kubectl apply -f -
  fi
