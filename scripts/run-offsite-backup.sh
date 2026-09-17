#!/usr/bin/env bash
# Daily Mac-side copy. Cloudflare SSH authentication and an awake Mac are required.
set -euo pipefail
umask 077
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_ROOT="${JAYWIKI_BACKUP_ROOT:-$HOME/Library/Application Support/JayWiki Backups}"
RECIPIENT_FILE="${JAYWIKI_BACKUP_RECIPIENT_FILE:-$HOME/.config/jaywiki-recovery/recipient.txt}"
mkdir -p "$BACKUP_ROOT"
chmod 0700 "$BACKUP_ROOT"
lock="$BACKUP_ROOT/.running"
mkdir "$lock" 2>/dev/null || { echo 'Another backup is running; refusing overlap.' >&2; exit 1; }
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
work="$(mktemp -d "$BACKUP_ROOT/.staging-${run_id}-XXXXXX")"
finish() {
  code=$?
  if [[ "$code" == 0 ]]; then
    rm -rf "$work"
  else
    # Retain failed partial files privately for diagnosis; never call these a backup.
    printf '{"status":"failed","run":"%s"}\n' "$run_id" > "$BACKUP_ROOT/last-attempt.json"
    /usr/bin/osascript -e 'display notification "자동 백업에 실패했습니다. JayWiki Backups 로그를 확인하세요." with title "JayWiki 백업 실패"' >/dev/null 2>&1 || true
  fi
  rmdir "$lock"
  exit "$code"
}
trap finish EXIT
recipient="$(cat "$RECIPIENT_FILE")"
cd "$ROOT"
bash scripts/pull-postgres-backup-secure.sh "$work/databases"
bash scripts/pull-minio-objects.sh "$work/minio"
bash scripts/pull-minio-config.sh "$work/minio-config" "$recipient"
bash scripts/backup-cluster-config.sh "$work/cluster-config.json.age" "$recipient"
tar czf - -C "$work" . | age -r "$recipient" -o "$BACKUP_ROOT/$run_id.tar.gz.age.partial"
mv "$BACKUP_ROOT/$run_id.tar.gz.age.partial" "$BACKUP_ROOT/$run_id.tar.gz.age"
(cd "$BACKUP_ROOT" && shasum -a 256 "$run_id.tar.gz.age" > "$run_id.tar.gz.age.sha256")
printf '{"status":"success","completedUtc":"%s","archive":"%s"}\n' "$(date -u +%FT%TZ)" "$run_id.tar.gz.age" > "$BACKUP_ROOT/last-success.json"
cp "$BACKUP_ROOT/last-success.json" "$BACKUP_ROOT/last-attempt.json"
echo 'Daily encrypted offsite database/object/configuration backup completed.'
