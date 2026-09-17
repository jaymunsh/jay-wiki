#!/usr/bin/env bash
# Inspect the bounded transfer bundle without selecting drafts for publication.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
python3 "$ROOT_DIR/scripts/build-blog-bundle.py" --all \
  --draft-dir "${BLOG_DRAFT_DIR:-${ROOT_DIR}/posts/jay-blog/drafts}" --output "$tmp/bundle.tgz"
