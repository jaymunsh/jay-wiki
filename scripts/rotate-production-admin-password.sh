#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-miniPC}"
NAMESPACE="${NAMESPACE:-backend}"
SECRET_NAME="${SECRET_NAME:-jaywiki-secrets}"
DEPLOYMENT="${DEPLOYMENT:-jaywiki}"
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

if [[ -t 0 ]]; then
  read -r -s -p 'New jay-wiki production admin password: ' password
  echo
  read -r -s -p 'Confirm new password: ' confirmation
  echo
else
  password="$(osascript -e 'text returned of (display dialog "New jay-wiki production admin password" default answer "" with hidden answer buttons {"Cancel", "Continue"} default button "Continue")')"
  confirmation="$(osascript -e 'text returned of (display dialog "Confirm new admin password" default answer "" with hidden answer buttons {"Cancel", "Update"} default button "Update")')"
fi

if [[ "${password}" != "${confirmation}" ]]; then
  echo 'Passwords do not match.' >&2
  exit 1
fi
if (( ${#password} < 8 )); then
  echo 'Password must contain at least 8 characters.' >&2
  exit 1
fi

password_b64="$(printf '%s' "${password}" | base64 | tr -d '\n')"
patch="{\"data\":{\"APP_ADMIN_PASSWORD\":\"${password_b64}\"}}"

printf '%s' "${patch}" | ssh "${REMOTE_HOST}" \
  "kubectl patch secret ${SECRET_NAME} -n ${NAMESPACE} --type merge --patch-file=/dev/stdin" >/dev/null
ssh "${REMOTE_HOST}" kubectl rollout restart deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" >/dev/null
ssh "${REMOTE_HOST}" kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout=180s

security add-generic-password \
  -U \
  -s "${KEYCHAIN_SERVICE}" \
  -a "${ADMIN_USERNAME}" \
  -w "${password}" >/dev/null

unset password confirmation password_b64 patch
echo "Updated ${ADMIN_USERNAME} in Kubernetes and macOS Keychain."
