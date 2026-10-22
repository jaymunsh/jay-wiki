#!/usr/bin/env bash
# 배포 결과를 텔레그램으로 보낸다. 알림 봇 자격증명은 클러스터 Secret 하나를 그대로 쓴다
# (Alertmanager 가 쓰는 obs/alertmanager-telegram). 러너가 miniPC 안이라 kubectl 로 읽힌다.
#
#   DEPLOY_STATUS=success COMMIT_SHA=... PREVIOUS_SHA=... RUN_URL=... scripts/notify-deploy-telegram.sh
#
# 성공은 브라우저 스모크가 끝난 뒤 한 통으로 보낸다. 실패는 배포 잡이 그 자리에서 보낸다.
# 알림 실패가 배포를 실패로 만들지 않는다. 배포는 이미 끝났고, 못 보낸 것은 못 보낸 것이다.
set -uo pipefail

SECRET_NAMESPACE="${SECRET_NAMESPACE:-obs}"
SECRET_NAME="${SECRET_NAME:-alertmanager-telegram}"
SOURCE_REPO="${SOURCE_REPO:-jaymunsh/jay-wiki}"
DEPLOY_STATUS="${DEPLOY_STATUS:-unknown}"
COMMIT_SHA="${COMMIT_SHA:-}"
PREVIOUS_SHA="${PREVIOUS_SHA:-}"
RELEASE_LABEL="${RELEASE_LABEL:-}"
ACTOR="${ACTOR:-}"
RUN_URL="${RUN_URL:-}"
ROLLED_BACK="${ROLLED_BACK:-false}"

read_key() {
  kubectl -n "${SECRET_NAMESPACE}" get "secret/${SECRET_NAME}" -o "jsonpath={.data.$1}" 2>/dev/null | base64 -d
}

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

case "${DEPLOY_STATUS}" in
  success) icon="✅"; headline="배포 완료"; deploy="✓"; smoke="✓" ;;
  failure) icon="🔴"; headline="배포 실패"; deploy="✗"; smoke="건너뜀" ;;
  cancelled) icon="🟡"; headline="배포 취소"; deploy="취소"; smoke="건너뜀" ;;
  # 브라우저 스모크는 배포가 끝난 뒤 별도 잡에서 돈다. 되돌리지 않았다는 것까지 제목에 적는다.
  browser-smoke-failed) icon="🟡"; headline="배포는 끝났지만 화면 검사가 실패했다 — 되돌리지 않았다"; deploy="✓"; smoke="✗" ;;
  *) icon="🟡"; headline="배포 ${DEPLOY_STATUS}"; deploy="?"; smoke="?" ;;
esac
rollback="없음"
if [ "${ROLLED_BACK}" = "true" ]; then
  icon="🔴"; headline="배포 실패 — 이전 이미지로 되돌림"; rollback="실행함"
fi

# 이전 배포와 이번 배포 사이에 병합된 PR 제목. 공개 저장소라 토큰 없이 읽힌다.
# 이미지 태그가 커밋 SHA 라서 이전 SHA 는 배포 전에 잡아 둔 이미지 태그에서 온다.
changes=""
if [ -n "${PREVIOUS_SHA}" ] && [ -n "${COMMIT_SHA}" ] && [ "${PREVIOUS_SHA}" != "${COMMIT_SHA}" ]; then
  changes="$(curl -fsS -m 15 "https://api.github.com/repos/${SOURCE_REPO}/compare/${PREVIOUS_SHA}...${COMMIT_SHA}" 2>/dev/null |
    jq -r '[.commits[].commit.message | select(startswith("Merge pull request #"))
            | (split("\n") | [(.[0] | capture("#(?<n>[0-9]+)").n), (.[2] // "")])] | .[:10][] | " • #\(.[0]) \(.[1])"' 2>/dev/null | esc)"
  [ -n "${changes}" ] || changes=" • 병합된 PR 없음 (커밋만 바뀜)"
else
  changes=" • 이전 버전을 몰라 생략"
fi

message="${icon} <b>${headline}</b>${RELEASE_LABEL:+ · ${RELEASE_LABEL}}

<b>바뀐 것</b>
${changes}

<b>검사</b>
• 배포: ${deploy} · 화면 검사: ${smoke} · 롤백: ${rollback}

<b>버전</b>
• commit: <code>${COMMIT_SHA:0:12}</code>${PREVIOUS_SHA:+ ← <code>${PREVIOUS_SHA:0:12}</code>}
• 실행: ${ACTOR}"

# 파이프라인이 안 올리는 것을 건드린 배포, 또는 사람이 마저 확인해야 하는 실패에는 한 줄을 더 붙인다.
if [ -n "${MANUAL_FOLLOWUP:-}" ]; then
  message="${message}

<b>할 일</b>
$(printf '%s' "${MANUAL_FOLLOWUP}" | esc)"
fi

links="🔗 <a href=\"${RUN_URL}\">실행 기록</a>"
if [ -n "${PREVIOUS_SHA}" ] && [ -n "${COMMIT_SHA}" ]; then
  links="${links} · <a href=\"https://github.com/${SOURCE_REPO}/compare/${PREVIOUS_SHA:0:12}...${COMMIT_SHA:0:12}\">바뀐 코드</a>"
fi
message="${message}

${links}"

if [ -n "${DRY_RUN:-}" ]; then
  printf '%s\n' "${message}"
  exit 0
fi

BOT_TOKEN="$(read_key bot-token)"
CHAT_ID="$(read_key chat-id)"
if [ -z "${BOT_TOKEN}" ] || [ -z "${CHAT_ID}" ]; then
  echo "::warning::telegram secret ${SECRET_NAMESPACE}/${SECRET_NAME} is missing; skipping deploy notification"
  exit 0
fi
echo "::add-mask::${BOT_TOKEN}"

if ! curl -sS -m 15 -o /dev/null \
  "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "disable_web_page_preview=true" \
  --data-urlencode "text=${message}"; then
  echo "::warning::telegram deploy notification failed to send"
fi
