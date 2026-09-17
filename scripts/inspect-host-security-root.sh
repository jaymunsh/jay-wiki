#!/usr/bin/env bash
# Read-only diagnostics. Run in the user's terminal so sudo never enters chat.
# Deliberately prints no kubeconfig, Secret payload, token, or key contents.
set -uo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run with sudo in your terminal.' >&2; exit 1; }
echo '[k3s encryption status]'
k3s secrets-encrypt status
echo '[datastore type]'
if [[ -f /var/lib/rancher/k3s/server/db/state.db ]]; then echo 'SQLite database present'; fi
if [[ -d /var/lib/rancher/k3s/server/db/etcd ]]; then echo 'etcd directory present'; fi
echo '[recovery file metadata only]'
for path in /var/lib/rancher/k3s/server/token /var/lib/rancher/k3s/server/cred/encryption-config.json /etc/rancher/k3s/k3s.yaml; do
  if [[ -e "$path" ]]; then stat -Lc '%a %U:%G %n' "$path"; else echo "Absent: $path"; fi
done
echo '[SSH global effective settings; Match-specific rules require separate review]'
sshd -T | awk '$1 ~ /^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin|x11forwarding|allowtcpforwarding|pubkeyauthentication)$/ {print}'
echo '[firewall]'
ufw status verbose
echo '[sudo timestamp policy]'
sudo -V | grep -iE 'timestamp|authentication timestamp' || true
