#!/usr/bin/env bash
# Targeted SSH + kubeconfig repair. Run on miniPC with sudo; inspect before --apply.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo on miniPC.' >&2; exit 1; }
account=${SUDO_USER:-}
[[ -n "$account" && "$account" != root ]] || { echo 'A non-root sudo user is required.' >&2; exit 1; }
group=$(id -gn "$account")
gid=$(id -g "$account")
unit=/etc/systemd/system/k3s.service
ssh_dropin=/etc/ssh/sshd_config.d/00-jaywiki-security.conf
# The account group must not accidentally grant other users cluster-admin access.
getent passwd | awk -F: -v gid="$gid" -v account="$account" '$4 == gid && $1 != account {found=1} END {exit found}'
members=$(getent group "$group" | cut -d: -f4)
[[ -z "$members" || "$members" == "$account" ]] || { echo 'Account group has other members; review manually.' >&2; exit 1; }
grep -q -- '--write-kubeconfig-mode=644' "$unit" || {
  echo 'Expected mode=644 was not found. Review the current unit instead of rewriting it.' >&2; exit 1;
}
if grep -q -- '--write-kubeconfig-group' "$unit"; then
  echo 'An explicit kubeconfig group already exists; review manually.' >&2; exit 1
fi
echo "Plan: disable password/root SSH login and X11 forwarding; preserve TCP forwarding."
echo "Plan: kubeconfig root:$group 0640; private user copy remains 0600."
echo 'Plan: persist mode/group in the k3s unit, daemon-reload, reload SSH only. No k3s restart.'
[[ ${1:-} == --apply ]] || exit 0

backup=$(mktemp -d /root/jaywiki-host-security.XXXXXXXX)
chmod 700 "$backup"
cp -a "$unit" "$backup/k3s.service"
[[ ! -e "$ssh_dropin" ]] || cp -a "$ssh_dropin" "$backup/ssh.conf"
stat -c '%a %u %g' /etc/rancher/k3s/k3s.yaml > "$backup/kubeconfig-permissions"
rollback() {
  cp -a "$backup/k3s.service" "$unit"
  if [[ -e "$backup/ssh.conf" ]]; then cp -a "$backup/ssh.conf" "$ssh_dropin"; else rm -f "$ssh_dropin"; fi
  read -r mode uid original_gid < "$backup/kubeconfig-permissions"
  chown "$uid:$original_gid" /etc/rancher/k3s/k3s.yaml
  chmod "$mode" /etc/rancher/k3s/k3s.yaml
  systemctl daemon-reload
  systemctl reload ssh
  echo "Repair failed; restored originals from $backup" >&2
}
trap rollback ERR
cat > "$ssh_dropin" <<'SSH'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
SSH
/usr/sbin/sshd -t
/usr/sbin/sshd -T | grep -q '^passwordauthentication no$'
python3 - "$unit" "$group" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text()
old = "'--write-kubeconfig-mode=644'"
if s.count(old) != 1:
    raise SystemExit('Unexpected service unit format; refusing to edit')
p.write_text(s.replace(old, "'--write-kubeconfig-mode=640' '--write-kubeconfig-group=" + sys.argv[2] + "'"))
PY
chown "root:$group" /etc/rancher/k3s/k3s.yaml
chmod 640 /etc/rancher/k3s/k3s.yaml
systemctl daemon-reload
# Existing runner and SSH account already have this primary group; no restart needed.
runuser -u "$account" -- /usr/local/bin/kubectl get --raw=/readyz
systemctl reload ssh
trap - ERR
echo "Applied. Root-only rollback copies: $backup"
echo 'Keep this terminal open and verify a second SSH connection before closing it.'
stat -c '%a %U:%G %n' /etc/rancher/k3s/k3s.yaml
/usr/sbin/sshd -T | awk '/^(passwordauthentication|permitrootlogin|x11forwarding|allowtcpforwarding) /'
