#!/usr/bin/env bash
# 위키 글·탭을 운영에서 지운다. 기본은 dry-run, --write 에서만 실제로 지운다.
# 비밀번호는 Keychain 에서 실행 순간에만 읽고 TOTP 는 사람이 넣는다.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
API_BASE="${JAYWIKI_API_BASE:-https://admin.leneu.cloud/api/bff}"

if [[ " $* " == *" --write "* ]]; then
  password="$(security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${ADMIN_USERNAME}" -w 2>/dev/null || true)"
  if [[ -z "${password}" ]]; then
    echo "Missing macOS Keychain service ${KEYCHAIN_SERVICE} for ${ADMIN_USERNAME}." >&2
    echo 'Run scripts/store-production-admin-password.sh first.' >&2
    exit 1
  fi
  if [[ -t 0 ]]; then
    read -r -s -p 'Current Google Authenticator TOTP: ' otp
    echo
  else
    otp="$(osascript -e 'text returned of (display dialog "Current Google Authenticator TOTP" default answer "" with hidden answer buttons {"Cancel", "Continue"} default button "Continue")')"
  fi
else
  password=''
  otp=''
fi

JAYWIKI_API_BASE="${API_BASE}" \
JAYWIKI_ADMIN_USERNAME="${ADMIN_USERNAME}" \
JAYWIKI_ADMIN_PASSWORD="${password}" \
JAYWIKI_ADMIN_OTP="${otp}" \
NODE_OPTIONS="${NODE_OPTIONS:-} --no-network-family-autoselection --dns-result-order=ipv4first" \
  node "${ROOT_DIR}/scripts/delete-wiki-articles.mjs" "$@"
