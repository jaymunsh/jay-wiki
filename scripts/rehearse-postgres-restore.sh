#!/usr/bin/env bash
# PostgreSQL 복원 리허설.
#
# "백업은 복원해보기 전까지 백업이 아니다" 를 명령으로 만든 것이다.
# 최신 dump 를 골라 sha256 을 검증하고, 임시 DB 에 pg_restore 한 뒤
# 핵심 테이블의 row count 를 원본과 비교하고, 마지막에 임시 DB 를 지운다.
#
#   scripts/rehearse-postgres-restore.sh
#   REMOTE_HOST=minipc scripts/rehearse-postgres-restore.sh
#
# 원본 DB 는 읽기만 한다. 복원은 항상 별도의 임시 DB 로만 한다.
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-}"
NAMESPACE="${NAMESPACE:-data}"
SOURCE_DB="${SOURCE_DB:-portfolio}"
case "${SOURCE_DB}" in
  portfolio)
    PGHOST="${PGHOST:-pg-postgresql.data.svc.cluster.local}"
    PGUSER="${PGUSER:-portfolio}"
    PASSWORD_SECRET="${PASSWORD_SECRET:-jaywiki-db-backup}"
    PASSWORD_KEY="${PASSWORD_KEY:-PGPASSWORD}"
    TABLES="${TABLES:-tb_article tb_revision tb_post tb_blog_post}"
    ;;
  payment|shipping)
    PGHOST="${PGHOST:-pg-services.data.svc.cluster.local}"
    PGUSER="${PGUSER:-${SOURCE_DB}_svc}"
    PASSWORD_SECRET="${PASSWORD_SECRET:-pg-services-secrets}"
    if [[ "${SOURCE_DB}" == payment ]]; then
      PASSWORD_KEY="${PASSWORD_KEY:-PAYMENT_SVC_PASSWORD}"
    else
      PASSWORD_KEY="${PASSWORD_KEY:-SHIPPING_SVC_PASSWORD}"
    fi
    : "${TABLES:?Set TABLES to the restored service tables to verify}"
    ;;
  *) echo 'SOURCE_DB must be portfolio, payment, or shipping' >&2; exit 1 ;;
esac
for value in "${NAMESPACE}" "${PGHOST}" "${PGUSER}" "${PASSWORD_SECRET}" "${PASSWORD_KEY}"; do
  [[ "${value}" =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo 'Invalid drill configuration' >&2; exit 1; }
done
for table in ${TABLES}; do
  [[ "${table}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo 'Invalid table name' >&2; exit 1; }
done
RESTORE_DB="restore_drill_$(date -u +%Y%m%d%H%M%S)"
POD_NAME="pg-restore-drill-$(date -u +%Y%m%d%H%M%S)"
# 복원 대조에 쓸 테이블. 위키 본문, 리비전, 게시판이 살아 있으면 복원이 유효하다.

kubectl_cmd() {
  if [[ -n "${REMOTE_HOST}" ]]; then
    local remote_command
    printf -v remote_command '%q ' kubectl "$@"
    ssh "${REMOTE_HOST}" "${remote_command}"
  else
    kubectl "$@"
  fi
}

cleanup() {
  echo "=== cleanup: drop temp db and pod ==="
  kubectl_cmd -n "${NAMESPACE}" exec "${POD_NAME}" -- \
    sh -c "dropdb --if-exists '${RESTORE_DB}'" >/dev/null 2>&1 || true
  kubectl_cmd -n "${NAMESPACE}" delete pod "${POD_NAME}" --ignore-not-found --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== start drill pod (credentials stay in Kubernetes Secret references) ==="
overrides=$(cat <<JSON
{
  "metadata": {"labels": {"app": "jaywiki-postgres-backup"}},
  "spec": {
    "restartPolicy": "Never",
    "automountServiceAccountToken": false,
    "securityContext": {"runAsNonRoot": true, "runAsUser": 10001, "runAsGroup": 10001,
      "seccompProfile": {"type": "RuntimeDefault"}},
    "containers": [{
      "name": "drill",
      "image": "postgres:18-alpine",
      "command": ["sleep", "1800"],
      "securityContext": {"allowPrivilegeEscalation": false, "capabilities": {"drop": ["ALL"]}},
      "resources": {"requests": {"cpu": "50m", "memory": "128Mi"},
        "limits": {"cpu": "300m", "memory": "512Mi"}},
      "env": [
        {"name": "PGHOST", "value": "${PGHOST}"},
        {"name": "PGUSER", "value": "${PGUSER}"},
        {"name": "PGPASSWORD", "valueFrom": {"secretKeyRef": {
          "name": "${PASSWORD_SECRET}", "key": "${PASSWORD_KEY}"
        }}}
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

kubectl_cmd -n "${NAMESPACE}" run "${POD_NAME}" \
  --image=postgres:18-alpine \
  --restart=Never \
  --overrides="${overrides}" >/dev/null
kubectl_cmd -n "${NAMESPACE}" wait --for=condition=Ready "pod/${POD_NAME}" --timeout=120s

drill_exec() {
  kubectl_cmd -n "${NAMESPACE}" exec "${POD_NAME}" -- sh -c "$1"
}

echo "=== 3. pick latest dump ==="
DUMP="$(drill_exec "ls -1t /backups/${SOURCE_DB}-*.dump 2>/dev/null | head -1")"
if [[ -z "${DUMP}" ]]; then
  echo "no dump found under /backups" >&2
  exit 1
fi
echo "dump: ${DUMP}"
drill_exec "ls -lh '${DUMP}' '${DUMP}.sha256'"

echo "=== 4. verify sha256 ==="
drill_exec "cd /backups && sha256sum -c '$(basename "${DUMP}").sha256'"

echo "=== 5. inspect dump table of contents ==="
drill_exec "pg_restore --list '${DUMP}' | head -20"

echo "=== 6. restore into temp db: ${RESTORE_DB} ==="
started=$(date +%s)
drill_exec "createdb '${RESTORE_DB}'"
# pg_restore 는 소유자/권한 경고를 남길 수 있으므로 --no-owner --no-privileges 로 리허설한다.
drill_exec "pg_restore --dbname='${RESTORE_DB}' --no-owner --no-privileges --exit-on-error '${DUMP}'"
finished=$(date +%s)
echo "restore duration: $((finished - started))s"

echo "=== 7. compare row counts (source vs restored) ==="
status=0
for table in ${TABLES}; do
  src="$(drill_exec "psql -d '${SOURCE_DB}' -tAc 'select count(*) from ${table}'" | tr -d '[:space:]')"
  dst="$(drill_exec "psql -d '${RESTORE_DB}' -tAc 'select count(*) from ${table}'" | tr -d '[:space:]')"
  if [[ "${src}" == "${dst}" ]]; then
    printf '  %-14s source=%-8s restored=%-8s OK\n' "${table}" "${src}" "${dst}"
  else
    printf '  %-14s source=%-8s restored=%-8s MISMATCH\n' "${table}" "${src}" "${dst}"
    status=1
  fi
done

echo "=== 8. drop temp db ==="
drill_exec "dropdb '${RESTORE_DB}'"

if [[ ${status} -ne 0 ]]; then
  echo "restore comparison FAILED: row counts differ; source writes since backup can also cause this" >&2
  exit 1
fi

echo "restore rehearsal PASSED: ${DUMP} -> ${RESTORE_DB} (dropped)"
echo "기록할 것: dump 파일명, sha256 검증 결과, restore 소요 시간, 테이블별 row count"
