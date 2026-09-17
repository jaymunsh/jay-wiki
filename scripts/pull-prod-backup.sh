#!/usr/bin/env bash
# Export three databases and current MinIO objects to a new private directory.
# Older backups are never automatically deleted. See docs/security-operations-2026-09-10.md.
set -euo pipefail
umask 077
OUT="${1:?Usage: pull-prod-backup.sh NEW_OUTPUT_DIRECTORY}"
REMOTE_HOST="${REMOTE_HOST:-${MINIPC_SSH:-miniPC}}"
[[ "$REMOTE_HOST" != *" "* ]] || { echo 'Use an SSH host alias, not shell arguments.' >&2; exit 1; }
export REMOTE_HOST
bash "$(dirname "$0")/pull-postgres-backup-secure.sh" "$OUT"
bash "$(dirname "$0")/pull-minio-objects.sh" "$OUT/minio"
echo 'Backup downloaded. Run database and logical MinIO restoration checks before relying on it.'
