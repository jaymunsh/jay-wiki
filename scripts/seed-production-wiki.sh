#!/usr/bin/env bash
set -euo pipefail

# 운영 위키 쓰기는 content-sync 하나로 모았다(2026-10-22). 이 길은 위키 전체를 밀어서 관리 화면 수정을
# 덮고, 맞춘 기준(content/wiki/sync-state.json)도 남기지 않는다. 대조(dry-run)만 남긴다.
for arg in "$@"; do
  if [[ "${arg}" == --write ]]; then
    echo '운영 위키 쓰기는 node scripts/content-sync.mjs --write <slug...> 로 한다.' >&2
    exit 2
  fi
done

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
