#!/usr/bin/env bash
# Encrypt API configuration and Secrets before writing any local backup bytes.
# This is NOT a k3s datastore/token/encryption-key backup; those require root.
set -euo pipefail
umask 077
OUT="${1:?Usage: backup-cluster-config.sh NEW_OUTPUT_FILE.age AGE_RECIPIENT}"
RECIPIENT="${2:?An age public recipient is required}"
REMOTE_HOST="${REMOTE_HOST:-miniPC}"
[[ ! -e "$OUT" && ! -e "$OUT.partial" ]] || { echo 'Refusing to overwrite an existing backup.' >&2; exit 1; }
trap 'rm -f "$OUT.partial"' EXIT
ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl get namespaces,secrets,configmaps,deployments,statefulsets,services,ingresses,networkpolicies,serviceaccounts,roles,rolebindings,clusterroles,clusterrolebindings,persistentvolumeclaims,cronjobs,middlewares.traefik.io,ingressroutes.traefik.io -A -o json' |
  age -r "$RECIPIENT" -o "$OUT.partial"
mv "$OUT.partial" "$OUT"
shasum -a 256 "$OUT" > "$OUT.sha256"
echo 'Encrypted API snapshot saved. The recovery identity must be kept separately.'
