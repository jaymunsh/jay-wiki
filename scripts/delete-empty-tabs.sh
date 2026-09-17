#!/usr/bin/env bash
# 운영에서 빈 탭을 지운다. 기본은 dry-run, --write 에서만 실제로 지운다.
#
#   scripts/delete-empty-tabs.sh governance retrospective
#   scripts/delete-empty-tabs.sh governance retrospective --write
#
# 시드는 upsert 라 탭을 지우지 않는다. 시드의 tabs 배열에서 뺀 탭은 운영에 빈 채로 남고,
# wikiCategories 에서도 뺐다면 acceptsUnmapped 인 LAB 그룹으로 새어 들어간다.
#
# 인증은 publish-blog-drafts.sh 와 같은 경계다. 비밀번호는 Keychain 에서 실행 순간에만
# 읽고 TOTP 는 사람이 넣는다. 이 파일은 둘 다 저장하지 않는다.
#
# 가드: 글이 하나라도 든 탭은 지우지 않는다. 지운 탭은 돌아오지 않는다.
set -euo pipefail

KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
API_BASE="${JAYWIKI_API_BASE:-https://admin.leneu.cloud/api/bff}"

access_token="${JAYWIKI_CF_ACCESS_TOKEN:-}"
if [[ "$API_BASE" =~ ^https://admin\.leneu\.cloud(/|$) ]] && [ -z "$access_token" ]; then
  access_token="$(cloudflared access token --app https://admin.leneu.cloud 2>/dev/null || true)"
  if [ -z "$access_token" ]; then
    echo "Cloudflare Access 인증이 없다. cloudflared access login https://admin.leneu.cloud 을 먼저 실행한다." >&2
    exit 1
  fi
fi
cf_curl() {
  if [ -n "$access_token" ]; then
    curl --config <(printf 'header = "CF-Access-Token: %s"\n' "$access_token") "$@"
  else
    curl "$@"
  fi
}

write=false
tabs=()
for arg in "$@"; do
  if [ "$arg" = "--write" ]; then write=true; else tabs+=("$arg"); fi
done
if [ ${#tabs[@]} -eq 0 ]; then
  echo "지울 탭 id 를 준다. 예: scripts/delete-empty-tabs.sh governance retrospective" >&2
  exit 2
fi

# 먼저 공개 API 로 글 수를 센다. 로그인 전에 확인해야 헛되이 TOTP 를 묻지 않는다.
snapshot="$(cf_curl -fsS "${API_BASE}/tabs")"
targets=()
for tab in "${tabs[@]}"; do
  count="$(jq -r --arg t "$tab" '[.[] | select(.tabId==$t) | (.articles // []) | length] | first // "none"' <<<"$snapshot")"
  case "$count" in
    none) echo "  건너뜀  ${tab} — 운영에 그런 탭이 없다" ;;
    0)    echo "  지운다  ${tab} — 글 0편"; targets+=("$tab") ;;
    *)    echo "  거부    ${tab} — 글 ${count}편이 들어 있다. 먼저 옮긴다" ;;
  esac
done
[ ${#targets[@]} -eq 0 ] && { echo "지울 것이 없다."; exit 0; }
$write || { echo; echo "--write 를 주면 실제로 지운다. 지금은 아무것도 안 했다."; exit 0; }

password="$(security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${ADMIN_USERNAME}" -w 2>/dev/null || true)"
if [ -z "${password}" ]; then
  echo "Keychain 에 ${KEYCHAIN_SERVICE} / ${ADMIN_USERNAME} 이 없다. scripts/store-production-admin-password.sh 를 먼저 돌린다." >&2
  exit 1
fi
# stdin 이 터미널이 아니면 read 가 아무 말 없이 멈춘다(에이전트 셸에서 실제로 밟았다).
# publish-blog-drafts.sh 와 같은 갈래를 둔다.
if [ -t 0 ]; then
  read -r -s -p 'Current Google Authenticator TOTP: ' otp
  echo
else
  otp="$(osascript -e 'text returned of (display dialog "Current Google Authenticator TOTP" default answer "" with hidden answer buttons {"Cancel", "Continue"} default button "Continue")')"
fi

jar="$(mktemp)"
trap 'rm -f "$jar"; unset password otp' EXIT
cf_curl -fsS -c "$jar" -X POST "${API_BASE}/auth/admin-login" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg u "$ADMIN_USERNAME" --arg p "$password" --arg o "$otp" '{username:$u,password:$p,otp:$o}')" \
  >/dev/null

for tab in "${targets[@]}"; do
  cf_curl -fsS -b "$jar" -X DELETE "${API_BASE}/tabs/${tab}" >/dev/null
  echo "  삭제됨  ${tab}"
done

echo
echo "확인: node scripts/check-wiki-consistency.mjs   # 「유령 탭 0」이 되어야 끝이다"
