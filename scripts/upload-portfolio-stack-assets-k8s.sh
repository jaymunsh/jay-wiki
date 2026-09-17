#!/usr/bin/env bash
set -euo pipefail

job_name="$(kubectl create -f infra/k8s/data/portfolio-stack-assets-job.yaml -o jsonpath='{.metadata.name}')"
cleanup() {
  kubectl -n data delete "job/${job_name}" --ignore-not-found >/dev/null
}
trap cleanup EXIT

if ! kubectl -n data wait "job/${job_name}" --for=condition=complete --timeout=4m; then
  kubectl -n data logs "job/${job_name}" --all-containers=true || true
  exit 1
fi

kubectl -n data logs "job/${job_name}" --all-containers=true
echo "Synced portfolio stack assets to MinIO."
