#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
# Watchdog 알림이 나가는 곳. 이 신호가 끊기면 healthchecks.io 가 알린다.
# 없어도 Alertmanager 는 뜨지만 그때 죽는 것이 하필 '알림이 죽은 것을 알리는 장치'라,
# 조용히 빠지지 않게 여기서 막는다. ping URL 자체가 비밀이라 저장소에 두지 않는다.
HEALTHCHECKS_PING_URL="${HEALTHCHECKS_PING_URL:-}"

if [[ -z "${TELEGRAM_BOT_TOKEN}" ]]; then
  echo "TELEGRAM_BOT_TOKEN is required" >&2
  exit 1
fi

if [[ ! "${HEALTHCHECKS_PING_URL}" =~ ^https://hc-ping\.com/ ]]; then
  echo "HEALTHCHECKS_PING_URL is required, for example https://hc-ping.com/<uuid>" >&2
  exit 1
fi

if [[ ! "${TELEGRAM_CHAT_ID}" =~ ^-?[0-9]+$ ]]; then
  echo "TELEGRAM_CHAT_ID must be an integer, for example -4266674385" >&2
  exit 1
fi

kubectl -n obs create secret generic alertmanager-telegram \
  --from-literal=bot-token="${TELEGRAM_BOT_TOKEN}" \
  --from-literal=chat-id="${TELEGRAM_CHAT_ID}" \
  --from-literal=healthchecks-url="${HEALTHCHECKS_PING_URL}" \
  --dry-run=client -o yaml | if [[ -n "${REMOTE_HOST}" ]]; then
    ssh "${REMOTE_HOST}" 'kubectl apply -f -'
  else
    kubectl apply -f -
  fi
