#!/usr/bin/env bash
# 이관이 끝난 LAB 글을 위키에서 지운다. migrate-lab-articles-to-blog.sh 다음에만 실행한다.
#
# 두 곳을 지운다.
#   1) PostgreSQL tb_article  — 블로그에 같은 slug 가 있는 글만
#   2) OpenSearch 위키 색인   — SQL 로 직접 지우면 애플리케이션 이벤트가 돌지 않아
#                               색인에 지운 글이 남는다. 문서 id 는 slug 다.
#      reindex 엔드포인트는 upsert 만 하므로 이걸 대신하지 못한다.
#
#   scripts/remove-migrated-lab-articles.sh
#   SKIP_OPENSEARCH=1 scripts/remove-migrated-lab-articles.sh   색인 정리를 건너뛴다
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="$HERE/remove-migrated-lab-articles.sql"
DB_USER="${PGUSER:-portfolio}"
DB_NAME="${PGDATABASE:-portfolio}"
CONTAINER="${BLOG_MIGRATION_CONTAINER:-pf-postgres}"
OS_URL="${OPENSEARCH_URL:-http://localhost:9200}"
OS_INDEX="${APP_OPENSEARCH_WIKI_INDEX:-jaywiki-articles-v1}"

# 지울 slug 를 먼저 받아둔다. 삭제 뒤에는 tb_article 에서 찾을 수 없다.
slugs=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -Atc "
  select a.slug from public.tb_article a
  where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
    and exists (select 1 from public.tb_blog_post p where p.slug = a.slug);")

if [[ -z "$slugs" ]]; then
  echo "지울 대상이 없다. 이미 지웠거나 이관이 안 됐다."
  exit 0
fi

docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - < "$SQL"

if [[ "${SKIP_OPENSEARCH:-}" == "1" ]]; then
  echo "OpenSearch 색인 정리를 건너뛴다. 검색 결과에 지운 글이 남는다."
  exit 0
fi

while IFS= read -r slug; do
  [[ -z "$slug" ]] && continue
  code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$OS_URL/$OS_INDEX/_doc/$slug")
  echo "opensearch delete $slug -> $code"
done <<< "$slugs"

curl -s -o /dev/null -X POST "$OS_URL/$OS_INDEX/_refresh"
echo "색인 정리 완료."
