#!/usr/bin/env bash
# 위키 시드가 ConfigMap 한 장에 들어가는지 본다. sync-wiki-content-k8s.sh 와 같은 한도다.
# 여기서 걸리면 배포가 아직 아무것도 안 건드린 상태다 — 배포 중에 터지면 롤백이 돈다.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
SEED_FILE="${WIKI_SEED_FILE:-$tmp/seed.mjs}"
if [[ -z "${WIKI_SEED_FILE:-}" ]]; then
  node "$ROOT_DIR/scripts/build-wiki-seed.mjs" "$SEED_FILE"
fi
# The deployment Job mounts only this file. Catch unresolved repository-local imports before
# any production manifest is changed instead of discovering them during content sync.
if grep -Eq "from[[:space:]]+['\"]\.\.?/" "$SEED_FILE"; then
  echo "생성된 위키 시드에 상대 모듈 import가 남아 있다" >&2
  grep -En "from[[:space:]]+['\"]\.\.?/" "$SEED_FILE" >&2
  exit 1
fi
LIMIT="${WIKI_SEED_GZ_LIMIT:-600000}"

raw="$(wc -c < "${SEED_FILE}" | tr -d ' ')"
gz="$(gzip -c "${SEED_FILE}" | wc -c | tr -d ' ')"

printf '위키 시드 %s 바이트 -> 압축 %s 바이트 (한도 %s, 남은 여유 %s)\n' \
  "${raw}" "${gz}" "${LIMIT}" "$((LIMIT - gz))"

if (( gz > LIMIT )); then
  echo "압축본이 한도를 넘었다. ConfigMap 을 그만 쓰고 MinIO 경유로 바꾼다 -- scripts/sync-wiki-content-k8s.sh 의 ponytail 주석" >&2
  exit 1
fi
