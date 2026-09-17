#!/usr/bin/env bash
# Single-server k3s 1.36.2 procedure. Execute only after a verified off-host
# datastore/token/key recovery test. Runs inside the host filesystem namespace.
set -euo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || exit 1
k3s --version | head -1 | grep -q 'v1.36.2+k3s1' || { echo 'Unreviewed k3s version'; exit 1; }
[[ -f /var/lib/rancher/k3s/server/db/state.db ]] || { echo 'Expected SQLite datastore'; exit 1; }
[[ ! -d /var/lib/rancher/k3s/server/db/etcd ]] || { echo 'Unexpected etcd datastore'; exit 1; }
[[ ! -e /var/lib/rancher/k3s/server/cred/encryption-config.json ]] || { echo 'Existing encryption configuration: review before continuing'; exit 1; }
count="$(k3s kubectl get nodes -o name | wc -l)"
[[ "$count" -eq 1 ]] || { echo 'This procedure is for one server only'; exit 1; }
ready() {
  for i in $(seq 1 90); do
    if k3s kubectl --request-timeout=3s get --raw=/readyz >/dev/null 2>&1 \
        && k3s secrets-encrypt status >/dev/null 2>&1; then return; fi
    sleep 2
  done
  echo 'API readiness timed out; retain recovery files and inspect state' >&2
  return 1
}
echo 'Preparing encryption configuration'
k3s secrets-encrypt enable
mkdir -p /etc/rancher/k3s/config.yaml.d
printf 'secrets-encryption: true\n' > /etc/rancher/k3s/config.yaml.d/90-jaywiki-secrets-encryption.yaml
# This drop-in contains only a boolean. k3s's kubectl wrapper also reads it for
# non-root operators, so the directory and flag must remain traversable/readable.
chmod 755 /etc/rancher/k3s/config.yaml.d
chmod 644 /etc/rancher/k3s/config.yaml.d/90-jaywiki-secrets-encryption.yaml
systemctl restart k3s
ready
status="$(k3s secrets-encrypt status)"
grep -q 'Encryption Status: Disabled' <<< "$status"
grep -q 'Current Rotation Stage: start' <<< "$status"
echo 'Reencrypting existing Secrets'
k3s secrets-encrypt rotate-keys
finished=false
for i in $(seq 1 120); do
  status="$(k3s secrets-encrypt status)"
  if grep -q 'Current Rotation Stage: reencrypt_finished' <<< "$status" && grep -q 'Encryption Status: Enabled' <<< "$status"; then
    finished=true
    break
  fi
  sleep 2
done
[[ "$finished" == true ]] || { echo 'Reencryption did not finish; inspect state before restarting'; exit 1; }
systemctl restart k3s
ready
status="$(k3s secrets-encrypt status)"
grep -q 'Encryption Status: Enabled' <<< "$status"
grep -q 'Current Rotation Stage: reencrypt_finished' <<< "$status"
printf '%s\n' "$status"
k3s kubectl get nodes
echo 'Encryption enabled. Capture and verify the new key/datastore recovery archive next.'
