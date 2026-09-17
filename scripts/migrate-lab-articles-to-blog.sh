#!/usr/bin/env bash
# LAB 8편을 tb_article 에서 tb_blog_post 로 복사한다. 일회성이지만 재실행해도 안전하다.
# 원본(tb_article)은 건드리지 않는다. 삭제는 화면 확인 뒤 사람이 따로 한다.
#
#   scripts/migrate-lab-articles-to-blog.sh              로컬(docker exec pf-postgres)
#   scripts/migrate-lab-articles-to-blog.sh --dry-run    옮길 대상만 센다
#   PGHOST=... PGUSER=... scripts/migrate-lab-articles-to-blog.sh   psql 로 직접
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="$HERE/migrate-lab-articles-to-blog.sql"
DB_USER="${PGUSER:-portfolio}"
DB_NAME="${PGDATABASE:-portfolio}"
CONTAINER="${BLOG_MIGRATION_CONTAINER:-pf-postgres}"

run_sql() {
  if [[ -n "${PGHOST:-}" ]]; then
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  else
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  fi
}

if [[ "${1:-}" == "--dry-run" ]]; then
  run_sql <<'EOF'
select a.parent_id, a.slug, a.created_at::date,
       exists (select 1 from public.tb_blog_post p where p.slug = a.slug) as already_migrated
from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and a.status = 'published'
order by a.parent_id, a.created_at;
EOF
  exit 0
fi

run_sql < "$SQL"
