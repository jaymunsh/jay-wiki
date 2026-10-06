#!/usr/bin/env bash
# A private host copy of the last persisted state; never print room contents.
set -euo pipefail
if ! kubectl -n frontend get deployment/jaywiki-omok >/dev/null 2>&1; then
  echo 'OMOK first deployment: no existing room file to back up'
  exit 0
fi
backup_dir="${OMOK_BACKUP_DIR:-${HOME}/.local/share/jaywiki/backups/omok}"
mkdir -p "${backup_dir}"
chmod 700 "${backup_dir}"
backup_file="$(mktemp "${backup_dir}/rooms-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")"
trap 'rm -f "$backup_file"' EXIT
kubectl -n frontend exec deployment/jaywiki-omok -- node --input-type=module -e \
  "import {readFile} from 'node:fs/promises'; try {process.stdout.write(await readFile('/app/data/rooms.json'));} catch(e) {if(e.code!=='ENOENT')throw e; process.stdout.write(JSON.stringify({version:1,rooms:[]}));}" >"${backup_file}"
python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["version"]==1 and isinstance(data["rooms"],list)' "${backup_file}"
chmod 600 "${backup_file}"
mv "${backup_file}" "${backup_file}.json"
find "${backup_dir}" -name 'rooms-*.json' -mtime +30 -delete
echo 'OMOK persisted room snapshot backed up (30 day retention)'
