#!/usr/bin/env bash
# Root-only. Verify GitHub has no active self-hosted job before calling.
set -euo pipefail
[[ $(id -u) == 0 && "${1:-}" == --runner-idle-verified ]] || exit 2
unit=actions.runner.jaymunsh-jay-wiki.jaypc.service
home=/opt/jaywiki-runner
[[ -f "$home/.kube/config" && -f "$home/runner/.credentials" ]] || exit 1
# Runner.Worker is present for a job. Refuse instead of killing deployment work.
if pgrep -f '[R]unner.Worker' >/dev/null; then
  echo 'A runner job is active; refusing account switch' >&2; exit 1
fi
systemctl stop "$unit"
install -d -m 0755 "/etc/systemd/system/$unit.d"
cat > "/etc/systemd/system/$unit.d/90-isolated-account.conf" <<'UNIT'
[Service]
User=jaywiki-runner
Group=jaywiki-runner
WorkingDirectory=/opt/jaywiki-runner/runner
ExecStart=
ExecStart=/opt/jaywiki-runner/runner/runsvc.sh
Environment=HOME=/opt/jaywiki-runner
Environment=RUNNER_TOOL_CACHE=/opt/jaywiki-runner/toolcache
Environment=KUBECONFIG=/opt/jaywiki-runner/.kube/config
NoNewPrivileges=true
CapabilityBoundingSet=
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/opt/jaywiki-runner
PrivateTmp=true
RestrictSUIDSGID=true
UMask=0077
UNIT
if [[ -f "$home/runner/.env" ]]; then
  sed -i '/^HOME=/d; /^KUBECONFIG=/d' "$home/runner/.env"
fi
systemctl daemon-reload
systemctl start "$unit"
systemctl is-active "$unit"
[[ "$(systemctl show "$unit" -p User --value)" == jaywiki-runner ]]
# This account must not gain the former administrator's filesystem authority.
runuser -u jaywiki-runner -- /bin/sh -c 'test ! -r /home/jaymunsh/.kube/config && test ! -r /etc/rancher/k3s/k3s.yaml && test ! -w /var/run/docker.sock'
echo 'Runner active under separate OS identity; administrator files/socket inaccessible.'
