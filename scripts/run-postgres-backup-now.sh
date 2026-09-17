#!/usr/bin/env bash
set -euo pipefail

JOB_NAME="jaywiki-postgres-backup-manual-$(date +%Y%m%d%H%M%S)"
REMOTE_HOST="${REMOTE_HOST:-}"

kubectl_cmd() {
  if [[ -n "${REMOTE_HOST}" ]]; then
    ssh "${REMOTE_HOST}" kubectl "$@"
  else
    kubectl "$@"
  fi
}

kubectl_cmd -n data create job "${JOB_NAME}" --from=cronjob/jaywiki-postgres-backup
kubectl_cmd -n data wait --for=condition=complete "job/${JOB_NAME}" --timeout=300s
kubectl_cmd -n data logs "job/${JOB_NAME}"
