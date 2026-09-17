#!/usr/bin/env bash
# Export all three production databases without credentials in exec arguments.
# The temporary pod only references existing Secrets; no Secret payload leaves Kubernetes.
set -euo pipefail
umask 077
OUT="${1:?Usage: pull-postgres-backup-secure.sh NEW_OUTPUT_DIRECTORY}"
REMOTE_HOST="${REMOTE_HOST:-miniPC}"
[[ ! -e "$OUT" ]] || { echo 'Output directory already exists; refusing to overwrite.' >&2; exit 1; }
mkdir -p "$OUT"
pod="jaywiki-offsite-backup-$(date -u +%Y%m%d%H%M%S)-$$"
cleanup() { ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data delete pod $pod --ignore-not-found --wait=false" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cat <<YAML | ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl create -f -'
apiVersion: v1
kind: Pod
metadata:
  name: $pod
  namespace: data
  labels: {app: jaywiki-postgres-backup}
spec:
  restartPolicy: Never
  activeDeadlineSeconds: 900
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    seccompProfile: {type: RuntimeDefault}
  containers:
    - name: backup
      image: postgres:18-alpine
      command: [sh, -c, 'sleep 900']
      securityContext:
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities: {drop: [ALL]}
      resources:
        requests: {cpu: 25m, memory: 32Mi}
        limits: {cpu: 300m, memory: 256Mi}
      env:
        - name: PORTFOLIO_PGPASSWORD
          valueFrom: {secretKeyRef: {name: jaywiki-db-backup, key: PGPASSWORD}}
        - name: PAYMENT_PGPASSWORD
          valueFrom: {secretKeyRef: {name: pg-services-secrets, key: PAYMENT_SVC_PASSWORD}}
        - name: SHIPPING_PGPASSWORD
          valueFrom: {secretKeyRef: {name: pg-services-secrets, key: SHIPPING_SVC_PASSWORD}}
YAML
ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data wait --for=condition=Ready pod/$pod --timeout=120s"
for db in portfolio payment shipping; do
  case "$db" in
    portfolio) host=pg-postgresql; role=portfolio; credential=PORTFOLIO_PGPASSWORD ;;
    payment) host=pg-services; role=payment_svc; credential=PAYMENT_PGPASSWORD ;;
    shipping) host=pg-services; role=shipping_svc; credential=SHIPPING_PGPASSWORD ;;
  esac
  # The escaped expansion runs inside the pod, not in the SSH or kubectl process.
  ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data exec $pod -- sh -ec 'export PGPASSWORD=\"\$$credential\"; exec pg_dump --host=$host --username=$role --format=custom --no-password $db'" > "$OUT/$db.dump.partial"
  mv "$OUT/$db.dump.partial" "$OUT/$db.dump"
  (cd "$OUT" && shasum -a 256 "$db.dump" > "$db.dump.sha256")
  docker run --rm --network none -v "$(cd "$OUT" && pwd):/backup:ro" postgres:18-alpine pg_restore --list "/backup/$db.dump" > "$OUT/$db.dump.toc"
  echo "$db: dump and archive directory verified"
done
printf 'Completed UTC: %s\nDatabase dumps are sequential, not a cross-service atomic snapshot.\n' "$(date -u +%FT%TZ)" > "$OUT/backup-info.txt"
