#!/usr/bin/env bash
# PreToolUse(Bash) 가드 — main 으로 직접 push 하는 것만 막는다.
#
# 무료 플랜 + 비공개 저장소라 브랜치 보호를 걸 수 없다(API 가 403). 그 구멍을
# 저장소 안에서 메운다. 배포는 push 가 아니라 PR 머지라, 이 가드가 배포를 막지 않는다.
#
# 훅 입력(JSON)은 stdin 으로 온다. 막을 때만 결정을 내고, 그 밖에는 조용히 통과시킨다.
set -uo pipefail

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null)"
case "$cmd" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

blocked=false
# origin main / HEAD:main / develop:main 처럼 main 을 명시한 경우
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]]|:)main([[:space:]]|$)'; then
  blocked=true
# 인자 없는 git push — 지금 있는 브랜치가 main 이면 같은 일이 난다
elif printf '%s' "$cmd" | grep -Eq 'git push([[:space:]]+(-[^[:space:]]+|origin))*[[:space:]]*$'; then
  [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = "main" ] && blocked=true
fi

[ "$blocked" = true ] || exit 0

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "main 에 직접 push 하지 않는다. main push 는 곧 운영 배포이고, 이 저장소는 브랜치 보호를 걸 수 없어 규율로만 지켜진다. 배포하려면 develop 을 main 에 머지한다 — docs/deploy-runbook.md 3번."
  }
}'
