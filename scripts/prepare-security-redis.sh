#!/usr/bin/env bash
# Run on the cluster host before switching application traffic. Does not switch the app.
set -euo pipefail
umask 077
if ! kubectl -n data get secret security-redis-auth >/dev/null 2>&1; then
  if kubectl -n backend get secret security-redis-auth >/dev/null 2>&1; then
    echo 'Backend credential already exists; reconcile it before creating a different password.' >&2
    exit 1
  fi
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  openssl rand -hex 32 | tr -d '\n' > "$tmp/password"
  kubectl -n data create secret generic security-redis-auth --from-file="password=$tmp/password" >/dev/null
fi
# Secret payload stays in the pipe; never print it or pass it as a process argument.
kubectl -n data get secret security-redis-auth -o json |
  python3 -c 'import json,sys; s=json.load(sys.stdin); print(json.dumps({"apiVersion":"v1","kind":"Secret","metadata":{"name":"security-redis-auth","namespace":"backend"},"type":"Opaque","data":s["data"]}))' |
  kubectl apply -f - >/dev/null
kubectl apply -f infra/k8s/data/security-redis.yaml
kubectl -n data rollout status statefulset/security-redis --timeout=180s
echo 'Security Redis is ready. Application cutover and existing security-key migration are separate steps.'
