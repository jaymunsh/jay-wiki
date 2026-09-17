#!/usr/bin/env bash
# 맥북에 받아 둔 사본이 진짜 되살아나는지 확인한다. 백업은 복원해보기 전까지 백업이 아니다.
#
#   scripts/rehearse-local-restore.sh .local-backups/<시각>
#
# miniPC 쪽 리허설(scripts/rehearse-postgres-restore.sh)과 목적이 다르다. 저쪽은 PVC 안의
# dump 를 클러스터에서 되살리고, 이쪽은 밖으로 나온 사본만으로 miniPC 없이 되살아나는지 본다.
# 운영에는 접속하지 않는다 -- docker 컨테이너 하나만 쓰고 끝나면 지운다.
set -euo pipefail

DIR="${1:?사본 디렉터리를 인자로 준다}"
ABS="$(cd "$DIR" && pwd)"
CONTAINER="jaywiki-restore-drill-$$"

# 백업 대상이 셋인데 한동안 portfolio 만 되살려 봤다. 나머지 둘은 pg_restore -l 로 목차만
# 봤을 뿐이라 「되살아나는 것을 본 적 없는 dump」였다. 셋을 같은 방법으로 돈다.
# 맥 기본 bash 는 3.2 라 연관 배열이 없다. case 로 둔다.
DBS="portfolio payment shipping"
tables_of() {
  case "$1" in
    portfolio) echo "tb_article tb_revision tb_blog_post tb_post tb_user" ;;
    payment)   echo "tb_payment tb_payment_outbox" ;;
    shipping)  echo "tb_shipping tb_shipping_outbox" ;;
  esac
}

for db in $DBS; do
  [[ -f "$ABS/$db.dump" ]] || { echo "$db.dump 가 없다: $DIR" >&2; exit 1; }
done

echo "[1/4] sha256"
for db in $DBS; do (cd "$DIR" && shasum -a 256 -c "$db.dump.sha256"); done

echo "[2/4] 임시 PostgreSQL"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=drill -v "$ABS":/b:ro postgres:18-alpine >/dev/null
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT
# 공식 이미지는 초기화 중에 임시 서버를 한 번 띄웠다 내린다. pg_isready 만 보면 그 임시 서버에
# 붙어서 곧 "terminating connection due to administrator command" 로 끊긴다. 초기화 완료를 먼저 본다.
deadline=$((SECONDS + 120))
until docker logs "$CONTAINER" 2>&1 | grep -q "init process complete"; do
  (( SECONDS < deadline )) || { echo 'PostgreSQL initialization timed out' >&2; exit 1; }
  sleep 1
done
until docker exec "$CONTAINER" psql -U postgres -tAc 'select 1' >/dev/null 2>&1; do
  (( SECONDS < deadline )) || { echo 'PostgreSQL readiness timed out' >&2; exit 1; }
  sleep 1
done

# dump 에 ALTER ... OWNER TO portfolio 가 43개 들어 있다. 역할이 없으면 데이터는 들어가지만
# 그만큼 오류가 찍힌다 -- 되살아난 것과 깨끗하게 되살아난 것은 다르다. 역할을 먼저 만든다.
# dump 에 ALTER ... OWNER TO 가 들어 있다. 역할이 없으면 데이터는 들어가지만 그만큼 오류가
# 찍힌다 -- 되살아난 것과 깨끗하게 되살아난 것은 다르다. 역할을 먼저 만든다.
for role in portfolio payment_svc shipping_svc; do
  docker exec "$CONTAINER" psql -U postgres -tAc "create role $role" >/dev/null 2>&1 || true
done

for db in $DBS; do
  echo "[3/4] 복원 - $db"
  docker exec "$CONTAINER" createdb -U postgres "drill_$db"
  start="$(python3 -c 'import time;print(time.time())')"
  docker exec "$CONTAINER" pg_restore --exit-on-error -U postgres -d "drill_$db" "/b/$db.dump"
  end="$(python3 -c 'import time;print(time.time())')"

  echo "[4/4] row 수 - $db"
  sql=""
  for t in $(tables_of "$db"); do
    [[ -n "$sql" ]] && sql="$sql union all "
    sql="$sql select '$t', count(*) from $t"
  done
  docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d "drill_$db" -tAc "$sql"
  python3 -c "print(f'  $db 복원 {$end - $start:.1f}초 · 오류 0')"
done

echo "임시 컨테이너는 지운다"
