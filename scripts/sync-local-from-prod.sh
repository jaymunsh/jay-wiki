#!/usr/bin/env bash
# 로컬을 운영과 같은 내용으로 맞춘다. 한 방향이다 — 운영 → 로컬. 운영에는 아무것도 쓰지 않는다.
#
#   scripts/sync-local-from-prod.sh          # 블로그 + 위키
#   scripts/sync-local-from-prod.sh blog     # 블로그만
#   scripts/sync-local-from-prod.sh wiki     # 위키만
#
# 조회수는 옮기지 않는다. 저장 payload 에 그 필드가 없다 — 로컬 조회수는 로컬에서 본 횟수다.
# 이미지도 옮기지 않는다. 블로그 본문과 대표 이미지가 전부 저장소의 web/public 정적 파일이라
# git 이 이미 맞춰 준다(외부 URL 이미지 0건, 2026-08-13 확인). 옛 .png 경로는
# next.config.ts 의 rewrite 가 같은 이름의 .webp 로 넘긴다.
set -euo pipefail

REMOTE="${JAYWIKI_BLOG_API:-https://portfolio.leneu.cloud/api/bff}"
LOCAL="${JAYWIKI_LOCAL_API:-http://localhost:8080/api}"
what="${1:-all}"

if ! curl -fsS -m 5 "${LOCAL%/api}/actuator/health" >/dev/null; then
  echo "로컬 Spring 이 안 떠 있다. cd spring && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun" >&2
  exit 1
fi

if [ "$what" = all ] || [ "$what" = blog ]; then
  echo "=== 블로그: 운영 → 로컬 ==="
  # 저장소 사본은 카테고리 폴더로 간다. 평평하게 받으면 기존 사본과 짝이 안 맞아 같은 글이 두 벌이 된다.
  rows="$(curl -fsS "${REMOTE}/blog/posts?size=200" |
    jq -r '(if type == "array" then . else (.items // .content) end)[] | "\(.id) \(.categorySlug // "uncategorized")"')"
  count=0
  while read -r id cat; do
    [ -n "$id" ] || continue
    node scripts/pull-blog-post.mjs "$id" --seed-local --out "posts/jay-blog/posts/${cat}"
    count=$((count + 1))
  done <<<"$rows"
  echo "블로그 ${count}편"

  # 로컬 API 로 새로 만드는 경로라 id 는 받은 순서대로 붙는다 -- 운영과 어긋난다.
  # 블로그 주소가 /<id>/<slug> 라 id 가 다르면 로컬에서 링크를 눌러 봐도 운영을 못 비춘다.
  node scripts/align-blog-ids.mjs --write

  # 운영에서만 바뀐 발행일을 초안 머리말에 새긴다. 배포는 러너에서 돌아 로컬 API 를 못 읽으므로,
  # 저장소가 날짜를 들고 있어야 다음 배포가 그 값을 그대로 쓴다.
  node scripts/stamp-blog-dates.mjs --write
fi

if [ "$what" = all ] || [ "$what" = wiki ]; then
  # 위키의 정본은 운영 DB 가 아니라 시드 파일이다. 그래서 운영에서 내려받지 않고 시드를 로컬에 돌린다.
  # 배포가 운영에 돌리는 것과 같은 스크립트라, 결과도 배포 뒤의 운영과 같아진다.
  echo "=== 위키: 시드 → 로컬 ==="
  node scripts/seed-portfolio-wiki.mjs
fi

echo "끝. http://localhost:3000 / http://blog.localhost:3000"
