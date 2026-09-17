#!/usr/bin/env bash
# Run as the new runner identity, not cluster-admin impersonation.
set -euo pipefail
check() {
  expected="$1"; shift
  actual="$(kubectl auth can-i "$@" 2>/dev/null || true)"
  [[ "$actual" == "$expected" ]] || { printf 'Unexpected permission: %s (wanted %s, got %s)\n' "$*" "$expected" "$actual" >&2; exit 1; }
  printf '%s: %s\n' "$expected" "$*"
}
check yes patch deployments -n backend
check yes create jobs -n backend
check yes patch deployments -n frontend
check yes patch statefulsets/secure-search -n data
check yes get middlewares.traefik.io/jaywiki-public-https-origin -n frontend
check no patch middlewares.traefik.io/jaywiki-public-https-origin -n frontend
check yes get cronjobs/jaywiki-postgres-backup -n data
check no get cronjobs/unrelated-backup -n data
check no get secrets -n kube-system
check no list secrets --all-namespaces
check no create clusterrolebindings
check no patch nodes
check no create roles -n backend
check no create serviceaccounts -n backend
check no create pods -n kube-system
check no patch configmaps/approved-bootstrap -n delivery
check no create serviceaccounts/token -n delivery
check no get secrets/application-deployer-token -n delivery
for file in infra/k8s/backend/jaywiki{,-payment-api,-shipping-api,-partner-simulator,-hpa}.yaml infra/k8s/frontend/jaywiki-web.yaml; do
  kubectl apply --dry-run=server -f "$file" >/dev/null
done
echo 'Application manifest admission succeeded with scoped credentials.'
