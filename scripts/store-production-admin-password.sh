#!/usr/bin/env bash
set -euo pipefail

KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

if [[ -t 0 ]]; then
  read -r -s -p 'Current jay-wiki production admin password: ' password
  echo
else
  password="$(osascript -e 'text returned of (display dialog "Current jay-wiki production admin password" default answer "" with hidden answer buttons {"Cancel", "Save"} default button "Save")')"
fi
if (( ${#password} < 8 )); then
  echo 'Password must contain at least 8 characters.' >&2
  exit 1
fi

security add-generic-password \
  -U \
  -s "${KEYCHAIN_SERVICE}" \
  -a "${ADMIN_USERNAME}" \
  -w "${password}" >/dev/null

unset password
echo "Stored ${ADMIN_USERNAME} in macOS Keychain service ${KEYCHAIN_SERVICE}."
