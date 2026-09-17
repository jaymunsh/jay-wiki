#!/usr/bin/env bash
set -euo pipefail
: "${OPENSEARCH_IMAGE:?OPENSEARCH_IMAGE is required}"
# Credentials, TLS and persistent storage are provisioned by the operator.
# Never recreate the retired unauthenticated Helm workload during an app deploy.
kubectl -n data get statefulset secure-search >/dev/null
kubectl -n data set image statefulset/secure-search "opensearch=${OPENSEARCH_IMAGE}"
kubectl -n data rollout status statefulset/secure-search --timeout="${OPENSEARCH_ROLLOUT_TIMEOUT:-10m}"
