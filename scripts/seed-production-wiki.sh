#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
API_BASE="${JAYWIKI_API_BASE:-https://admin.leneu.cloud/api/bff}"

password="$(security find-generic-password \
  -s "${KEYCHAIN_SERVICE}" \
  -a "${ADMIN_USERNAME}" \
  -w 2>/dev/null || true)"
if [[ -z "${password}" ]]; then
  echo "Missing macOS Keychain service ${KEYCHAIN_SERVICE} for ${ADMIN_USERNAME}." >&2
  echo 'Run scripts/store-production-admin-password.sh first.' >&2
  exit 1
fi

if [[ "${1:-}" == "--write" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p 'Current Google Authenticator TOTP: ' otp
    echo
  else
    otp="$(osascript -e 'text returned of (display dialog "Current Google Authenticator TOTP" default answer "" with hidden answer buttons {"Cancel", "Continue"} default button "Continue")')"
  fi
  args=(--allow-remote-write)
else
  otp=''
  args=(--dry-run)
fi

JAYWIKI_API_BASE="${API_BASE}" \
JAYWIKI_ADMIN_PASSWORD="${password}" \
JAYWIKI_ADMIN_OTP="${otp}" \
NODE_OPTIONS="${NODE_OPTIONS:-} --no-network-family-autoselection --dns-result-order=ipv4first" \
  node "${ROOT_DIR}/scripts/seed-portfolio-wiki.mjs" "${args[@]}"

unset password otp
