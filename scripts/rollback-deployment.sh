#!/usr/bin/env bash
# 배포 후 스모크 테스트가 실패했을 때 캡처된 Deployment 를 배포 전 이미지로 되돌린다.
# CI 의 실패 경로에서 호출하고, 수동 롤백 리허설에도 같은 스크립트를 쓴다.
#
#   scripts/capture-deployment-images.sh /tmp/jaywiki-previous-images.tsv
#   ROLLBACK_STATE_FILE=/tmp/jaywiki-previous-images.tsv scripts/rollback-deployment.sh
#
set -euo pipefail

ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-180s}"
: "${ROLLBACK_STATE_FILE:?ROLLBACK_STATE_FILE is required}"
if [ ! -s "${ROLLBACK_STATE_FILE}" ]; then
  echo "rollback state is missing or empty: ${ROLLBACK_STATE_FILE}" >&2
  exit 1
fi

targets=()

echo "=== rollback: restore captured images ==="
while IFS=$'\t' read -r namespace deployment container image; do
  [ -n "${namespace}" ] && [ -n "${deployment}" ] && [ -n "${container}" ] && [ -n "${image}" ] || {
    echo "invalid rollback state row" >&2
    exit 1
  }
  echo "--- ${namespace}/${deployment}:${container} <- ${image}"
  kubectl -n "${namespace}" set image "deployment/${deployment}" "${container}=${image}"
  targets+=("${namespace}/${deployment}")
done <"${ROLLBACK_STATE_FILE}"

echo "=== rollback: wait for rollout ==="
for entry in "${targets[@]}"; do
  namespace="${entry%%/*}"
  deployment="${entry##*/}"
  kubectl -n "${namespace}" rollout status "deployment/${deployment}" --timeout="${ROLLOUT_TIMEOUT}"
done

echo "=== rollback: current images ==="
for entry in "${targets[@]}"; do
  namespace="${entry%%/*}"
  deployment="${entry##*/}"
  kubectl -n "${namespace}" get "deployment/${deployment}" \
    -o jsonpath="{.metadata.name}{'\t'}{.spec.template.spec.containers[0].image}{'\n'}"
done

echo "=== rollback: public smoke ==="
SITE_ORIGIN="${SITE_ORIGIN:-https://portfolio.leneu.cloud}"
curl -fsS "${SITE_ORIGIN}" >/dev/null
curl -fsS "${SITE_ORIGIN}/api/bff/board/posts?page=0&size=1" >/dev/null
echo "rollback verified: ${SITE_ORIGIN} responds"
