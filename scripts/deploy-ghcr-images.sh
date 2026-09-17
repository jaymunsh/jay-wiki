#!/usr/bin/env bash
# GHCR 의 immutable SHA 이미지로 다섯 Deployment 를 교체한다.
# rollout 이 실패하면 배포 전에 캡처한 정확한 이미지로 되돌린 뒤 실패로 끝낸다.
# (스모크 테스트 실패 시의 롤백은 scripts/rollback-deployment.sh 가 담당한다.)
set -euo pipefail

: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
: "${WEB_IMAGE:?WEB_IMAGE is required}"
: "${PAYMENT_IMAGE:?PAYMENT_IMAGE is required}"
: "${SHIPPING_IMAGE:?SHIPPING_IMAGE is required}"
: "${PARTNER_IMAGE:?PARTNER_IMAGE is required}"

# 상한이지 목표가 아니다. 2026-08-15 배포에서 180초로 두 번 연속 실패했고, 실측은 이렇다.
#
#   같은 단계 / 이미지가 노드에 캐시된 상태  ->  33초
#   같은 단계 / 웹 이미지를 새로 받아야 하는 상태 -> 281초에도 못 끝냄 (약 7분 걸렸다)
#   직전 배포(#26) -> 60초
#
# 오류 이벤트는 하나도 없었다. Pulling 에서 멈춰 있었고, 나중에 보니 이미지는 결국 받아져
# 있었다. 즉 깨진 게 아니라 콜드 풀이 상한을 넘긴 것이다. 집 회선이라 그날그날 다르므로
# 상한을 넉넉히 둔다 -- 실패를 늦게 알게 되는 대신, 멀쩡한 배포가 시간 때문에 죽지 않는다.
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-600s}"
: "${ROLLBACK_STATE_FILE:?ROLLBACK_STATE_FILE is required}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# "namespace/deployment" 형태로, set image 를 마친 것만 쌓는다.
updated=()

rollback_updated() {
  if [ ${#updated[@]} -eq 0 ]; then
    return
  fi
  echo "::error::rollout failed — restoring captured deployment images"
  ROLLBACK_STATE_FILE="${ROLLBACK_STATE_FILE}" ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT}" \
    "${SCRIPT_DIR}/rollback-deployment.sh" || true
}

diagnose_rollout_failure() {
  echo "::group::rollout diagnostics"
  kubectl -n backend get deployment,replicaset,pod -l app=jaywiki -o wide || true
  kubectl -n backend describe deployment/jaywiki || true
  kubectl -n backend describe pods -l app=jaywiki || true
  kubectl -n backend logs -l app=jaywiki --all-containers=true --prefix=true --tail=200 || true
  kubectl -n backend logs -l app=jaywiki --all-containers=true --prefix=true --previous --tail=200 || true
  kubectl -n backend get events --sort-by=.lastTimestamp | tail -n 80 || true
  echo "::endgroup::"
}

trap 'diagnose_rollout_failure; rollback_updated' ERR

set_image() {
  local namespace="$1" deployment="$2" container="$3" image="$4"
  kubectl -n "${namespace}" set image "deployment/${deployment}" "${container}=${image}"
  updated+=("${namespace}/${deployment}")
}

set_image backend jaywiki-payment-api jaywiki-payment-api "${PAYMENT_IMAGE}"
set_image backend jaywiki-shipping-api jaywiki-shipping-api "${SHIPPING_IMAGE}"
set_image backend jaywiki-partner-simulator jaywiki-partner-simulator "${PARTNER_IMAGE}"
set_image backend jaywiki jaywiki "${BACKEND_IMAGE}"
set_image frontend jaywiki-web jaywiki-web "${WEB_IMAGE}"

kubectl -n backend rollout status deployment/jaywiki-payment-api --timeout="${ROLLOUT_TIMEOUT}"
kubectl -n backend rollout status deployment/jaywiki-shipping-api --timeout="${ROLLOUT_TIMEOUT}"
kubectl -n backend rollout status deployment/jaywiki-partner-simulator --timeout="${ROLLOUT_TIMEOUT}"
kubectl -n backend rollout status deployment/jaywiki --timeout="${ROLLOUT_TIMEOUT}"
kubectl -n frontend rollout status deployment/jaywiki-web --timeout="${ROLLOUT_TIMEOUT}"

trap - ERR

kubectl -n backend get pods -l app=jaywiki-payment-api
kubectl -n backend get pods -l app=jaywiki-shipping-api
kubectl -n backend get pods -l app=jaywiki-partner-simulator
kubectl -n backend get pods -l app=jaywiki
kubectl -n frontend get pods -l app=jaywiki-web
