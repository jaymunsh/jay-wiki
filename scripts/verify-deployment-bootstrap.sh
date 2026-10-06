#!/usr/bin/env bash
set -euo pipefail
expected="$(python3 scripts/deployment-bootstrap-fingerprint.py)"
actual="$(kubectl -n delivery get configmap approved-bootstrap -o jsonpath='{.data.sha256}')"
[[ "$expected" == "$actual" ]] || { echo 'Operator infrastructure has changed; apply and approve it with the administrator identity before deployment.' >&2; exit 1; }
for namespace in backend frontend data; do
  kubectl -n "$namespace" get secret ghcr-pull -o name >/dev/null
done
kubectl -n backend get secret jaywiki-secrets security-redis-auth cache-redis-auth opensearch-app-auth -o name >/dev/null

# Check the named backup prerequisite before changing any application image.
kubectl -n data get cronjob jaywiki-postgres-backup -o name >/dev/null
kubectl -n frontend get middleware jaywiki-public-https-origin jaywiki-public-https-redirect -o name >/dev/null
kubectl -n frontend get ingressroute jaywiki-public-http-redirect -o name >/dev/null
# OMOK application and first-deployment rollback require these narrowly scoped grants.
kubectl auth can-i create persistentvolumeclaims -n frontend | grep -qx yes
kubectl auth can-i patch persistentvolumeclaims/jaywiki-omok-data -n frontend | grep -qx yes
for resource in deployments services ingresses networkpolicies; do
  kubectl auth can-i delete "${resource}/jaywiki-omok" -n frontend | grep -qx yes
done
if kubectl auth can-i delete persistentvolumeclaims/jaywiki-omok-data -n frontend | grep -qx yes; then
  echo 'Application identity must not be able to delete OMOK persistent data' >&2
  exit 1
fi
