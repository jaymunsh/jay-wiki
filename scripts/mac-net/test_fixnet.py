"""Simulate recovery branches with shell function stubs; never touch routes."""
from pathlib import Path
import os
import subprocess
import tempfile
import unittest


class FixnetIntegrationTests(unittest.TestCase):
    def simulate(self, scenario):
        source = Path(__file__).with_name("fixnet.zsh").read_text()
        source = source.rsplit('\nfixnet "$@"', 1)[0]
        stubs = r'''
public_checks=0
ping() {
  local target="${@: -1}"
  if [[ "$target" == 192.168.0.1 ]]; then
    [[ "$SCENARIO" != gateway ]]
    return
  fi
  (( public_checks += 1 ))
  case "$SCENARIO" in
    healthy|dns_only) return 0;;
    partial|no_routes|icmp_only|wrong_target|mixed_tunnel) [[ "$target" != 8.8.8.8 ]]; return;;
    routes) [[ "$public_checks" -gt 1 ]]; return;;
    fallback) return 1;;
    gateway) return 1;;
  esac
}
route() {
  if [[ "${*: -1}" == default ]]; then
    print 'gateway: 192.168.0.1'
  else
    if [[ "$SCENARIO" == wrong_target ]]; then
      print 'interface: en0'
    else
      print 'interface: utun8'
    fi
  fi
}
netstat() {
  print 'default 192.168.0.1 UGScg en0'
  [[ "$SCENARIO" == no_routes ]] && return
  print '0/2 utun8 UScg utun8'
  print '64/2 utun8 USc utun8'
  print '128.0/2 utun8 USc utun8'
  if [[ "$SCENARIO" == mixed_tunnel ]]; then
    print '192.0.0/2 utun9 USc utun9'
  else
    print '192.0.0/2 utun8 USc utun8'
  fi
}
netsnap() { print "capture:$1" >> "$HOME/events"; print '/fixture/record'; }
https_ok() { [[ "$SCENARIO" == icmp_only || "$SCENARIO" == dns_only ]]; }
domain_ok() { [[ "$SCENARIO" != dns_only ]]; }
sudo() { print "delete:$5:$6" >> "$HOME/events"; print 'delete net'; }
fixnet
'''
        with tempfile.TemporaryDirectory() as directory:
            env = dict(os.environ, HOME=directory, SCENARIO=scenario)
            result = subprocess.run(["/bin/zsh", "-f", "-c", source + stubs], env=env,
                                    capture_output=True, text=True, timeout=5)
            events = Path(directory) / "events"
            return result.returncode, events.read_text().splitlines() if events.exists() else []

    def test_healthy_does_not_mutate_or_collect(self):
        self.assertEqual(self.simulate("healthy"), (0, []))

    def test_gateway_failure_still_collects_without_repair(self):
        self.assertEqual(self.simulate("gateway"), (1, ["capture:down"]))

    def test_capture_precedes_deletes_and_follows_them(self):
        self.assertEqual(self.simulate("routes"),
                         (0, ["capture:down"] + self.deletes() + ["capture:after"]))

    def test_failed_recovery_does_not_restart_tailscale(self):
        self.assertEqual(self.simulate("fallback"),
                         (1, ["capture:down"] + self.deletes() + ["capture:after"]))

    @staticmethod
    def deletes():
        return ["delete:-iface:utun8"] * 4

    def test_one_public_target_working_does_not_claim_healthy(self):
        code, events = self.simulate("partial")
        self.assertEqual(code, 1)
        self.assertEqual(events, ["capture:down"] + self.deletes() + ["capture:after"])

    def test_one_public_target_failure_without_tunnel_does_not_delete(self):
        self.assertEqual(self.simulate("no_routes"), (1, ["capture:down"]))

    def test_icmp_only_failure_is_recorded_without_route_deletion(self):
        self.assertEqual(self.simulate("icmp_only"), (1, ["capture:down"]))

    def test_domain_failure_does_not_claim_healthy(self):
        self.assertEqual(self.simulate("dns_only"), (1, ["capture:down"]))

    def test_other_target_route_is_recorded_without_deletion(self):
        self.assertEqual(self.simulate("wrong_target"), (1, ["capture:down"]))

    def test_mixed_tunnel_routes_are_recorded_without_deletion(self):
        self.assertEqual(self.simulate("mixed_tunnel"), (1, ["capture:down"]))


if __name__ == "__main__":
    unittest.main()
