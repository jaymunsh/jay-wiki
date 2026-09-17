#!/usr/bin/env bash
# 백업에서 블로그 글 한 편(또는 여러 편)의 본문을 되돌린다.
#
#   REMOTE_HOST=minipc scripts/restore-blog-post-from-backup.sh cloudflare-cache-purge
#   REMOTE_HOST=minipc scripts/restore-blog-post-from-backup.sh cloudflare-cache-purge --write
#
# 기본은 dry-run 이다. --write 를 줘야 운영 DB 를 고친다.
#
# 왜 필요한가: 배포가 블로그 글을 덮게 되면(BLOG_PUBLISH_AUTO) 잘못 덮였을 때 되돌리는 길이
# 있어야 한다. 콘텐츠 반영 직전 백업은 이미 파이프라인에 있지만, 그것으로 블로그를 되돌리는
# 절차가 없었다. rehearse-postgres-restore.sh 는 "덤프가 읽히는가"를 보고, 이 스크립트는
# "그 덤프로 글을 되돌릴 수 있는가"를 본다.
#
# 왜 UPDATE 인가: 행을 지웠다 넣으면 tb_blog_post_tag·tb_blog_comment 가 자식이라 FK 에 걸리고,
# 지운 순간 댓글이 cascade 로 같이 사라진다. 되돌릴 것은 본문이지 글의 정체가 아니다.
# 그래서 열만 덮는다 -- id 도 조회수도 댓글도 그대로 남는다.
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-}"
NAMESPACE="${NAMESPACE:-data}"
SOURCE_DB="${SOURCE_DB:-portfolio}"
PGHOST="${PGHOST:-pg-postgresql.data.svc.cluster.local}"
PGUSER="${PGUSER:-portfolio}"
RESTORE_DB="blog_restore_$(date -u +%Y%m%d%H%M%S)"
POD_NAME="blog-restore-$(date -u +%Y%m%d%H%M%S)"

write=false
slugs=()
for arg in "$@"; do
  if [ "$arg" = "--write" ]; then write=true; else slugs+=("$arg"); fi
done
if [ ${#slugs[@]} -eq 0 ]; then
  echo "되돌릴 글의 slug 를 준다. 예: $0 cloudflare-cache-purge" >&2
  exit 2
fi
# SQL 목록으로 넣기 전에 형태를 본다. slug 는 소문자·숫자·하이픈뿐이다.
for slug in "${slugs[@]}"; do
  case "$slug" in
    *[!a-z0-9-]*) echo "slug 형태가 아니다: ${slug}" >&2; exit 2 ;;
  esac
done
in_list="'$(IFS='|'; printf '%s' "${slugs[*]}" | sed "s/|/','/g")'"

kubectl_cmd() {
  if [[ -n "${REMOTE_HOST}" ]]; then ssh "${REMOTE_HOST}" kubectl "$@"; else kubectl "$@"; fi
}

cleanup() {
  kubectl_cmd -n "${NAMESPACE}" exec "${POD_NAME}" -- sh -c "dropdb --if-exists '${RESTORE_DB}'" >/dev/null 2>&1 || true
  kubectl_cmd -n "${NAMESPACE}" delete pod "${POD_NAME}" --ignore-not-found --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== 1. 백업 계정 비밀번호 ==="
PGPASSWORD="$(kubectl_cmd -n "${NAMESPACE}" get secret jaywiki-db-backup -o jsonpath='{.data.PGPASSWORD}' | base64 -d)"
[ -n "${PGPASSWORD}" ] || { echo "jaywiki-db-backup 에 PGPASSWORD 가 없다" >&2; exit 1; }

echo "=== 2. 작업 파드 (백업 PVC 를 읽기로 붙인다) ==="
overrides=$(cat <<JSON
{
  "spec": {
    "restartPolicy": "Never",
    "containers": [{
      "name": "restore",
      "image": "postgres:18-alpine",
      "command": ["sleep", "1800"],
      "env": [
        {"name": "PGHOST", "value": "${PGHOST}"},
        {"name": "PGUSER", "value": "${PGUSER}"},
        {"name": "PGPASSWORD", "value": "${PGPASSWORD}"}
      ],
      "volumeMounts": [{"name": "backups", "mountPath": "/backups", "readOnly": true}]
    }],
    "volumes": [{
      "name": "backups",
      "persistentVolumeClaim": {"claimName": "jaywiki-pg-backups", "readOnly": true}
    }]
  }
}
JSON
)
kubectl_cmd -n "${NAMESPACE}" run "${POD_NAME}" --image=postgres:18-alpine --restart=Never \
  --overrides="${overrides}" >/dev/null
kubectl_cmd -n "${NAMESPACE}" wait --for=condition=Ready "pod/${POD_NAME}" --timeout=120s

exec_in() { kubectl_cmd -n "${NAMESPACE}" exec "${POD_NAME}" -- sh -c "$1"; }

echo "=== 3. 최신 덤프 ==="
DUMP="$(exec_in "ls -1t /backups/portfolio-*.dump 2>/dev/null | head -1")"
[ -n "${DUMP}" ] || { echo "/backups 에 덤프가 없다" >&2; exit 1; }
echo "덤프: ${DUMP}"
exec_in "cd /backups && sha256sum -c '$(basename "${DUMP}").sha256'"

echo "=== 4. 블로그 표만 임시 DB 로 복원 ==="
exec_in "createdb '${RESTORE_DB}'"
exec_in "pg_restore --dbname='${RESTORE_DB}' --no-owner --no-privileges --exit-on-error \
  --table=tb_blog_post '${DUMP}'"

echo "=== 5. 지금 운영과 무엇이 다른가 ==="
exec_in "psql -d '${SOURCE_DB}' -c \"
  select b.slug,
         length(b.body) as now_len,
         b.updated_at
  from tb_blog_post b where b.slug in (${in_list}) order by b.slug\""
exec_in "psql -d '${RESTORE_DB}' -c \"
  select slug, length(body) as backup_len, updated_at
  from tb_blog_post where slug in (${in_list}) order by slug\""

if ! $write; then
  echo
  echo "--write 를 주면 백업 쪽 본문으로 덮는다. 지금은 아무것도 안 했다."
  exit 0
fi

echo "=== 6. 되돌린다 (열만 덮는다 -- id·조회수·댓글은 그대로) ==="
# 두 DB 가 같은 서버라 dblink 없이 파일로 옮긴다. 본문에 탭·줄바꿈이 있어 CSV 로 쓴다.
exec_in "psql -d '${RESTORE_DB}' -c \"\\copy (select slug,title,summary,body,toc_enabled \
  from tb_blog_post where slug in (${in_list})) to '/tmp/blog-restore.csv' csv\""
# \copy 는 psql 메타명령이라 다른 SQL 과 한 -c 에 못 넣는다. 파일로 돌린다.
exec_in "cat > /tmp/blog-restore.sql <<'SQL'
create temp table blog_restore(slug text, title text, summary text, body text, toc_enabled boolean);
\\copy blog_restore from '/tmp/blog-restore.csv' csv
update tb_blog_post p
   set title = r.title, summary = r.summary, body = r.body,
       toc_enabled = r.toc_enabled, updated_at = now()
  from blog_restore r
 where p.slug = r.slug;
SQL
psql -d '${SOURCE_DB}' -v ON_ERROR_STOP=1 -f /tmp/blog-restore.sql"

echo "=== 7. 되돌린 뒤 ==="
exec_in "psql -d '${SOURCE_DB}' -c \"
  select slug, length(body) as len, updated_at from tb_blog_post
  where slug in (${in_list}) order by slug\""
echo
echo "화면으로 확인한다: https://blog.leneu.cloud"
echo "기록할 것: 덤프 파일명, 걸린 시간, 되돌린 slug, 댓글·태그가 그대로인지"
