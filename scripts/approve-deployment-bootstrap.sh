#!/usr/bin/env bash
# Operator-only: execute after inspecting and applying the infrastructure diff.
set -euo pipefail
[[ "${1:-}" == --applied-and-verified ]] || { echo 'Apply and verify operator infrastructure before recording approval.' >&2; exit 2; }
kubectl auth can-i create clusterrolebindings | grep -qx yes
kubectl apply -f infra/k8s/00-namespaces.yaml
kubectl apply -f infra/k8s/delivery/application-deployer.yaml
kubectl apply -f infra/k8s/delivery/public-origin-proxy.yaml
kubectl apply -f infra/k8s/backend/jaywiki-control-rbac.yaml
kubectl apply -f infra/k8s/backend/rehearsal-isolation.yaml
for namespace in backend frontend data; do
  kubectl get namespace "$namespace" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' | grep -qx baseline
done
fingerprint="$(python3 scripts/deployment-bootstrap-fingerprint.py)"
kubectl -n delivery create configmap approved-bootstrap --from-literal="sha256=$fingerprint" --dry-run=client -o yaml | kubectl apply -f -
