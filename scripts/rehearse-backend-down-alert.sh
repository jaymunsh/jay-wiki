#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-miniPC}"
HOLD_SECONDS="${HOLD_SECONDS:-120}"

ssh "${REMOTE_HOST}" HOLD_SECONDS="${HOLD_SECONDS}" 'bash -s' <<'REMOTE'
set -euo pipefail

current="$(kubectl -n backend get deploy jaywiki -o jsonpath="{.spec.replicas}")"
if [[ -z "${current}" || "${current}" == "0" ]]; then
  current="1"
fi

restore() {
  kubectl -n backend scale deploy/jaywiki --replicas="${current}" >/dev/null
  kubectl -n backend rollout status deploy/jaywiki --timeout=180s >/dev/null
}
trap restore EXIT

echo "scaling backend/jaywiki from ${current} to 0 for ${HOLD_SECONDS}s"
kubectl -n backend scale deploy/jaywiki --replicas=0
sleep "${HOLD_SECONDS}"
echo "restoring backend/jaywiki to ${current}"
restore
trap - EXIT
echo "backend restored"
REMOTE
