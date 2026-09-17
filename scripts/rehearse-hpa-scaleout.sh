#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-miniPC}"
LOAD_SECONDS="${LOAD_SECONDS:-180}"
WORKERS="${WORKERS:-8}"

scp infra/k8s/backend/jaywiki-hpa.yaml "${REMOTE_HOST}:/tmp/jaywiki-hpa.yaml" >/dev/null

ssh "${REMOTE_HOST}" LOAD_SECONDS="${LOAD_SECONDS}" WORKERS="${WORKERS}" 'bash -s' <<'REMOTE'
set -euo pipefail

name="jaywiki-load-$(date +%Y%m%d%H%M%S)"
cleanup() {
  kubectl -n backend delete pod "${name}" --ignore-not-found=true >/dev/null
}
trap cleanup EXIT

kubectl apply -f /tmp/jaywiki-hpa.yaml >/dev/null 2>&1 || true
kubectl -n backend delete pod "${name}" --ignore-not-found=true >/dev/null
kubectl -n backend run "${name}" \
  --image=curlimages/curl:8.11.1 \
  --restart=Never \
  --command -- /bin/sh -c "
    end=\$((\$(date +%s) + ${LOAD_SECONDS}))
    worker() {
      while [ \$(date +%s) -lt \${end} ]; do
        curl -fsS 'http://jaywiki:8080/api/board/search?q=%EC%83%98%ED%94%8C' >/dev/null || true
      done
    }
    i=0
    while [ \${i} -lt ${WORKERS} ]; do
      worker &
      i=\$((i + 1))
    done
    wait
  " >/dev/null

echo "load pod ${name} started for ${LOAD_SECONDS}s with ${WORKERS} workers"
for i in $(seq 1 24); do
  kubectl -n backend get hpa jaywiki
  kubectl -n backend get deploy jaywiki -o jsonpath='replicas={.status.readyReplicas}/{.spec.replicas}{"\n"}'
  sleep 10
done
REMOTE
