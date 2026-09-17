#!/usr/bin/env bash
# 배포 직전의 실제 컨테이너 이미지를 저장한다. 롤백은 revision 번호가 아니라 이 파일을 기준으로 한다.
set -euo pipefail

STATE_FILE="${1:?usage: capture-deployment-images.sh STATE_FILE}"
: >"${STATE_FILE}"

capture() {
  local namespace="$1" deployment="$2" container="$3" image
  if ! image="$(kubectl -n "${namespace}" get "deployment/${deployment}" \
    -o "jsonpath={.spec.template.spec.containers[?(@.name=='${container}')].image}")"; then
    echo "::warning::no previous deployment found for ${namespace}/${deployment}"
    return
  fi
  if [ -z "${image}" ]; then
    echo "::warning::no previous image found for ${namespace}/${deployment}:${container}"
    return
  fi
  printf '%s\t%s\t%s\t%s\n' "${namespace}" "${deployment}" "${container}" "${image}" >>"${STATE_FILE}"
}

capture backend jaywiki jaywiki
capture backend jaywiki-payment-api jaywiki-payment-api
capture backend jaywiki-shipping-api jaywiki-shipping-api
capture backend jaywiki-partner-simulator jaywiki-partner-simulator
capture frontend jaywiki-web jaywiki-web

captured_count="$(wc -l <"${STATE_FILE}" | tr -d ' ')"
# shipping-api 는 첫 배포에 아직 없다. 그 판은 4개로 잡히고 다음 판부터 5개다.
if [ "${captured_count}" -lt 3 ] || [ "${captured_count}" -gt 5 ]; then
  echo "expected 3 to 5 deployment images, captured ${captured_count}; aborting before deployment mutation" >&2
  exit 1
fi
echo "captured ${captured_count} deployment image(s) in ${STATE_FILE}"
