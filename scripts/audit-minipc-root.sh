#!/usr/bin/env bash
# Read-only host inspection. Never prints private keys, kubeconfig contents or environment values.
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then
  echo 'Run with sudo on the miniPC. This script does not change configuration.' >&2
  exit 1
fi
echo 'SSH effective configuration'
/usr/sbin/sshd -T | awk '/^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|allowtcpforwarding|gatewayports|x11forwarding|maxauthtries|logingracetime|permitemptypasswords) /'
echo 'Firewall'
ufw status verbose
echo 'Kubernetes credential file permissions (contents excluded)'
stat -c '%a %U:%G %n' /etc/rancher/k3s/k3s.yaml
echo 'K3s kubeconfig mode override (other arguments excluded)'
systemctl show k3s -p ExecStart --value | python3 -c '
import re, sys
s = sys.stdin.read()
m = re.search(r"--write-kubeconfig-mode(?:=|\s+)([0-7]+)", s)
print("command_line_mode=" + (m.group(1) if m else "not specified"))
'
echo 'Kubernetes Secret encryption status'
k3s secrets-encrypt status || true
echo 'Automatic security update configuration'
grep -hE '^[[:space:]]*APT::Periodic::(Update-Package-Lists|Unattended-Upgrade)' /etc/apt/apt.conf.d/* || true
echo 'Failed SSH attempts in the last day (count only)'
journalctl -u ssh --since '24 hours ago' --no-pager | awk '/Failed password|Invalid user|authentication failure/ {n++} END {print n+0}'
echo 'Listening sockets'
ss -lntu
