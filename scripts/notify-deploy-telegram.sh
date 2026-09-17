#!/usr/bin/env bash
# 배포 결과를 텔레그램으로 보낸다. 알림 봇 자격증명은 클러스터 Secret 하나를 그대로 쓴다
# (Alertmanager 가 쓰는 obs/alertmanager-telegram). 러너가 miniPC 안이라 kubectl 로 읽힌다.
#
#   DEPLOY_STATUS=success COMMIT_SHA=... COMMIT_TITLE=... RUN_URL=... scripts/notify-deploy-telegram.sh
#
# 알림 실패가 배포를 실패로 만들지 않는다. 배포는 이미 끝났고, 못 보낸 것은 못 보낸 것이다.
set -uo pipefail

SECRET_NAMESPACE="${SECRET_NAMESPACE:-obs}"
SECRET_NAME="${SECRET_NAME:-alertmanager-telegram}"
DEPLOY_STATUS="${DEPLOY_STATUS:-unknown}"
COMMIT_SHA="${COMMIT_SHA:-}"
# 커밋 메시지는 여러 줄이라 첫 줄만 쓴다. workflow_dispatch 면 아예 비어 있다.
COMMIT_TITLE="$(printf '%s' "${COMMIT_TITLE:-}" | head -1)"
ACTOR="${ACTOR:-}"
RUN_URL="${RUN_URL:-}"
ROLLED_BACK="${ROLLED_BACK:-false}"

read_key() {
  kubectl -n "${SECRET_NAMESPACE}" get "secret/${SECRET_NAME}" -o "jsonpath={.data.$1}" 2>/dev/null | base64 -d
}

BOT_TOKEN="$(read_key bot-token)"
CHAT_ID="$(read_key chat-id)"
if [ -z "${BOT_TOKEN}" ] || [ -z "${CHAT_ID}" ]; then
  echo "::warning::telegram secret ${SECRET_NAMESPACE}/${SECRET_NAME} is missing; skipping deploy notification"
  exit 0
fi
echo "::add-mask::${BOT_TOKEN}"

case "${DEPLOY_STATUS}" in
  success) headline="배포 완료" ;;
  failure) headline="배포 실패" ;;
  cancelled) headline="배포 취소" ;;
  # 브라우저 스모크는 배포가 끝난 뒤 별도 잡에서 돈다. 되돌리지 않았다는 것까지 제목에 적는다.
  browser-smoke-failed) headline="배포는 끝났지만 화면 검사가 실패했다 — 되돌리지 않았다" ;;
  *) headline="배포 ${DEPLOY_STATUS}" ;;
esac
if [ "${ROLLED_BACK}" = "true" ]; then
  headline="배포 실패 — 이전 이미지로 되돌림"
fi

# 이미지 태그가 커밋 SHA 라서 짧은 SHA 하나로 지금 도는 것을 특정할 수 있다.
message="[jay-wiki] ${headline}
commit ${COMMIT_SHA:0:12} ${COMMIT_TITLE}
by ${ACTOR}
${RUN_URL}"

# 파이프라인이 안 올리는 것을 건드린 배포에는 한 줄을 더 붙인다. 사람이 miniPC 에서
# 올려야 반영되는데, 안 올려도 배포가 성공으로 끝나 티가 안 난다.
if [ -n "${MANUAL_FOLLOWUP:-}" ]; then
  message="${message}

사람이 마저 해야 한다: ${MANUAL_FOLLOWUP}"
fi

if ! curl -sS -m 15 -o /dev/null \
  "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "disable_web_page_preview=true" \
  --data-urlencode "text=${message}"; then
  echo "::warning::telegram deploy notification failed to send"
fi
