#!/usr/bin/env bash
# Installed root-owned at /usr/local/sbin/jaywiki-drive-backup, run daily by jaywiki-drive-backup.timer (05:00 KST,
# after the jaywiki-postgres-backup CronJob at 03:17). Same shape as anotar's apps/anotar/deploy/drive-backup.sh:
# tar.gz → rclone crypt (contents encrypted, names readable) → Google Drive leneu-backup/jaywiki/daily, plus
# monthly/ on the 1st. Keeps 3 days in daily/, monthly/ forever. Pings healthchecks jay-wiki-backup only after
# the upload succeeded, so a missing, stale or failed backup shows up as a missing ping.
# Archive: the CronJob's three pg_dump files, the MinIO volume as-is, and an API snapshot (Secrets included).
# Config: /etc/leneu-backup/rclone.conf (copied from Oracle: remote "backup" = crypt over a drive.file token)
# and /etc/leneu-backup/hc-ping-key, both root 0600.
set -uo pipefail
export RCLONE_CONFIG=/etc/leneu-backup/rclone.conf KUBECONFIG=/etc/rancher/k3s/k3s.yaml
day=$(TZ=Asia/Seoul date +%Y%m%d)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
fail() { echo "jaywiki: $*" >&2; exit 1; }

# local-path volumes are <pv>_<namespace>_<pvc>; match by name so a recreated PV does not break this.
storage=/var/lib/rancher/k3s/storage
pg=$(echo "$storage"/*_data_jaywiki-pg-backups)
minio=$(cd "$storage" && echo *_data_minio)
[[ -d $pg && -d $storage/$minio ]] || fail "volume not found under $storage"

# Newest dump only if it is from the last 26 hours; an old one means the CronJob stopped.
p=$(find "$pg" -maxdepth 1 -type f -name 'portfolio-*.dump' -mmin -1560 -printf '%T@ %f\n' | sort -n | tail -1 | cut -d' ' -f2)
[[ -n $p ]] || fail "no postgres dump in the last 26 hours"
stamp=${p#portfolio-}; stamp=${stamp%.dump}
# One CronJob run writes all three with the same stamp. Its checksums carry the pod's /backups path.
for db in portfolio payment shipping; do sed 's#/backups/##' "$pg/$db-$stamp.dump.sha256"; done |
  (cd "$pg" && sha256sum -c --quiet) || fail "dump checksum mismatch or missing dump for $stamp"
dumps=(portfolio-"$stamp".dump payment-"$stamp".dump shipping-"$stamp".dump)

kubectl get namespaces,secrets,configmaps,deployments,statefulsets,services,ingresses,networkpolicies,serviceaccounts,roles,rolebindings,clusterroles,clusterrolebindings,persistentvolumeclaims,cronjobs,middlewares.traefik.io,ingressroutes.traefik.io -A -o json > "$work/cluster-config.json" ||
  fail "cluster config export failed"

file=$work/jaywiki.tar.gz name=jaywiki-$day.tar.gz
# ponytail: MinIO is copied live, not as a snapshot (same as the old Mac mirror). Restore needs the same MinIO image.
# tar exits 1 when a file changed while read; only 2+ is fatal.
tar -czf "$file" -C "$pg" "${dumps[@]}" -C "$storage" "$minio" -C "$work" cluster-config.json
(( $? <= 1 )) || fail "tar failed"
rclone copyto "$file" "backup:jaywiki/daily/$name" &&
  { [[ ${day:6:2} != 01 ]] || rclone copyto "$file" "backup:jaywiki/monthly/jaywiki-${day:0:6}.tar.gz"; } &&
  rclone delete "backup:jaywiki/daily" --min-age 3d &&
  printf 'url = "https://hc-ping.com/%s/jay-wiki-backup"\n' "$(cat /etc/leneu-backup/hc-ping-key)" |
    curl -fsS -m 10 --retry 3 -o /dev/null -K - &&
  echo "jaywiki: uploaded $name ($(du -h "$file" | cut -f1))"
