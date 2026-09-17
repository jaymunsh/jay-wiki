#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-miniPC}"
ALERT_NAME="${ALERT_NAME:-JaywikiTelegramTest}"

ssh "${REMOTE_HOST}" ALERT_NAME="${ALERT_NAME}" 'bash -s' <<'REMOTE'
set -euo pipefail

kubectl -n obs port-forward svc/prom-alertmanager 9093:9093 >/tmp/jaywiki-alertmanager-pf.log 2>&1 &
pf=$!
cleanup() {
  kill "$pf" 2>/dev/null || true
}
trap cleanup EXIT

sleep 3

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ends="$(date -u -d "+5 minutes" +%Y-%m-%dT%H:%M:%SZ)"

cat > /tmp/jaywiki-telegram-test-alert.json <<JSON
[
  {
    "labels": {
      "alertname": "${ALERT_NAME}",
      "severity": "warning",
      "service": "jaywiki",
      "source": "manual"
    },
    "annotations": {
      "summary": "Manual Telegram notification test",
      "description": "This alert was sent directly to Alertmanager to verify Telegram delivery."
    },
    "startsAt": "${now}",
    "endsAt": "${ends}"
  }
]
JSON

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/jaywiki-telegram-test-alert.json \
  http://127.0.0.1:9093/api/v2/alerts

echo "sent ${ALERT_NAME} to Alertmanager"
REMOTE
