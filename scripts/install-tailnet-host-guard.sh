#!/usr/bin/env bash
# Root-only. Preserve SSH tunnels (including Beekeeper DB access) from owner devices.
# This narrows the host boundary; it does not rewrite the Tailscale control-plane ACL.
set -euo pipefail
[[ $(id -u) == 0 ]] || exit 1
install -d -m 0755 /etc/jaywiki
/usr/bin/tailscale status --json | /usr/bin/python3 -c '
import ipaddress,json,pathlib,sys
s=json.load(sys.stdin); owner=s["Self"]["UserID"]
peers=list(s.get("Peer",{}).values())
assert peers and all(p["UserID"]==owner for p in peers), "Review devices belonging to other users first"
addresses=[ipaddress.ip_address(ip) for p in peers for ip in p["TailscaleIPs"]]
v4=", ".join(str(ip) for ip in addresses if ip.version==4)
v6=", ".join(str(ip) for ip in addresses if ip.version==6)
assert v4 and v6
rules="""flush table inet jaywiki_tailnet
table inet jaywiki_tailnet {
  chain incoming {
    type filter hook input priority -10; policy accept;
    iifname \"tailscale0\" ct state established,related accept
    iifname \"tailscale0\" ip saddr { IPV4 } tcp dport 22 accept
    iifname \"tailscale0\" ip6 saddr { IPV6 } tcp dport 22 accept
    iifname \"tailscale0\" counter drop
  }
  chain forwarded {
    type filter hook forward priority -10; policy accept;
    iifname \"tailscale0\" ct state established,related accept
    iifname \"tailscale0\" counter drop
  }
}
""".replace("IPV4",v4).replace("IPV6",v6)
pathlib.Path("/etc/jaywiki/tailnet-guard.nft").write_text(rules)
print("Prepared SSH-only boundary for",len(peers),"owner devices")'
cat > /usr/local/sbin/jaywiki-tailnet-guard <<'GUARD'
#!/bin/sh
set -eu
# Replacing our own table is atomic; never flush another application's firewall.
/usr/sbin/nft list table inet jaywiki_tailnet >/dev/null 2>&1 || /usr/sbin/nft add table inet jaywiki_tailnet
/usr/sbin/nft -c -f /etc/jaywiki/tailnet-guard.nft
/usr/sbin/nft -f /etc/jaywiki/tailnet-guard.nft
GUARD
chmod 0755 /usr/local/sbin/jaywiki-tailnet-guard
cat > /etc/systemd/system/jaywiki-tailnet-guard.service <<'UNIT'
[Unit]
Description=Limit tailnet ingress to owner SSH tunnels
Before=tailscaled.service
After=network-pre.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/jaywiki-tailnet-guard
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now jaywiki-tailnet-guard.service
systemctl is-active jaywiki-tailnet-guard.service
