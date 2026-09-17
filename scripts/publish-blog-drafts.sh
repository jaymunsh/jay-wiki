#!/usr/bin/env bash
# posts/jay-blog/drafts/*.md 를 운영 블로그에 발행한다. 기본은 dry-run, --write 에서만 실제로 올린다.
# 비밀번호는 Keychain 에서 실행 순간에만 읽고 TOTP 는 사람이 넣는다.
# seed-production-wiki.sh 와 같은 인증 경계다.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
API_BASE="${JAYWIKI_API_BASE:-https://admin.leneu.cloud/api/bff}"
# 로컬이 떠 있으면 발행일을 거기서 읽어 운영에 그대로 싣는다. /sync 와 같은 규칙이다.
LOCAL_API_BASE="${JAYWIKI_LOCAL_API_BASE:-http://localhost:8080/api}"

password="$(security find-generic-password \
  -s "${KEYCHAIN_SERVICE}" \
  -a "${ADMIN_USERNAME}" \
  -w 2>/dev/null || true)"
if [[ -z "${password}" ]]; then
  echo "Missing macOS Keychain service ${KEYCHAIN_SERVICE} for ${ADMIN_USERNAME}." >&2
  echo 'Run scripts/store-production-admin-password.sh first.' >&2
  exit 1
fi

# 블로그는 목록 조회도 관리 API 뒤에 있어서 dry-run 에도 로그인이 필요하다.
# 위키 seed 는 dry-run 이 공개 API 만 읽어 TOTP 없이 됐다 — 그 차이다.
if [[ -t 0 ]]; then
  read -r -s -p 'Current Google Authenticator TOTP: ' otp
  echo
else
  otp="$(osascript -e 'text returned of (display dialog "Current Google Authenticator TOTP" default answer "" with hidden answer buttons {"Cancel", "Continue"} default button "Continue")')"
fi

args=("$@")

# seed-production-wiki.sh 와 같은 네트워크 옵션이 필요하다.
# 없으면 IPv6 를 먼저 잡아 fetch 가 그대로 실패한다.
JAYWIKI_API_BASE="${API_BASE}" \
JAYWIKI_ADMIN_USERNAME="${ADMIN_USERNAME}" \
JAYWIKI_ADMIN_PASSWORD="${password}" \
JAYWIKI_ADMIN_OTP="${otp}" \
JAYWIKI_LOCAL_API_BASE="${LOCAL_API_BASE}" \
NODE_OPTIONS="${NODE_OPTIONS:-} --no-network-family-autoselection --dns-result-order=ipv4first" \
  node "${ROOT_DIR}/scripts/publish-blog-drafts.mjs" ${args[@]+"${args[@]}"}

unset password otp
