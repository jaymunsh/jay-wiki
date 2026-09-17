#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-miniPC}"
NAMESPACE="${NAMESPACE:-backend}"
SECRET_NAME="${SECRET_NAME:-jaywiki-secrets}"
DEPLOYMENT="${DEPLOYMENT:-jaywiki}"
ACCOUNT="${ACCOUNT:-admin@portfolio.leneu.cloud}"
ISSUER="${ISSUER:-jay-wiki}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

"${ROOT_DIR}/spring/gradlew" -q -p "${ROOT_DIR}/spring" generateAdminTotp \
  --args="${TEMP_DIR} ${ISSUER} ${ACCOUNT}"
secret="$(<"${TEMP_DIR}/admin-totp.secret")"
open "${TEMP_DIR}/admin-totp.png"
echo "Google Authenticator에서 열린 QR을 스캔하세요."
read -r -p "앱 등록을 완료했습니까? [y/N] " confirmed
if [[ ! "${confirmed}" =~ ^[Yy]$ ]]; then
  echo "No cluster change was made."
  exit 0
fi

enabled_b64="$(printf 'true' | base64 | tr -d '\n')"
secret_b64="$(printf '%s' "${secret}" | base64 | tr -d '\n')"
patch="{\"data\":{\"APP_ADMIN_TOTP_ENABLED\":\"${enabled_b64}\",\"APP_ADMIN_TOTP_SECRET\":\"${secret_b64}\"}}"

printf '%s' "${patch}" | ssh "${REMOTE_HOST}" \
  "kubectl patch secret ${SECRET_NAME} -n ${NAMESPACE} --type merge --patch-file=/dev/stdin" >/dev/null
ssh "${REMOTE_HOST}" kubectl rollout restart deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" >/dev/null
ssh "${REMOTE_HOST}" kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout=180s

echo "TOTP is enabled. Verify one admin login before closing this terminal."
unset secret secret_b64 patch
