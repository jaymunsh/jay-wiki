import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("netrecord", Path(__file__).with_name("netrecord.py"))
netrecord = importlib.util.module_from_spec(spec)
spec.loader.exec_module(netrecord)


class NetrecordTests(unittest.TestCase):
    def test_timeout_preserves_partial_output(self):
        meta, text = netrecord.run_command(
            [sys.executable, "-c", "import time;print('before',flush=True);time.sleep(10)"], .15)
        self.assertEqual(meta["status"], "timeout")
        self.assertIn("before", text)

    def test_missing_command_and_output_cap(self):
        meta, _ = netrecord.run_command(["/no/such/netrecord-command"])
        self.assertEqual(meta["status"], "unavailable")
        meta, text = netrecord.run_command([sys.executable, "-c", "print('a'*10000)"], limit=40)
        self.assertTrue(meta["truncated"])
        self.assertEqual(len(text), 40)

    def test_gateway_does_not_treat_tunnel_link_as_ip(self):
        self.assertIsNone(netrecord.gateway_address("gateway: link#35\n"))
        self.assertEqual(netrecord.gateway_address("gateway: 192.168.0.1\n"), "192.168.0.1")

    def test_private_prefs_are_not_saved(self):
        text = netrecord.filtered_prefs(json.dumps({"RouteAll": False, "Persist": {"PrivateKey": "SECRET"}}))
        self.assertNotIn("SECRET", text)
        self.assertFalse(json.loads(text)["RouteAll"])
        self.assertNotIn("SECRET", netrecord.filtered_prefs("error SECRET"))

    def test_vendor_copy_is_bounded_and_missing_file_is_recorded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "source").write_bytes(b"0123456789")
            meta = netrecord.copy_tail(root / "source", root / "copy", 4)
            self.assertEqual((root / "copy").read_bytes(), b"6789")
            self.assertTrue(meta["truncated"])
            self.assertEqual(netrecord.copy_tail(root / "missing", root / "x")["status"], "unavailable")

    def test_complete_capture_with_missing_tools_and_previous_comparison(self):
        def fake_run(argv, timeout=8, limit=netrecord.LIMIT):
            return {"status": "unavailable", "exit_code": None, "command": argv}, "missing tool\n"
        with tempfile.TemporaryDirectory() as directory, patch.object(netrecord, "run_command", fake_run):
            root = Path(directory)
            with patch.object(netrecord, "HOME", root / "missing-home"):
                first = netrecord.collect("ok", root)
                second = netrecord.collect("down", root, "Wi-Fi connected, browser failed")
            manifest = json.loads((second / "manifest.json").read_text())
            self.assertTrue(manifest["complete"])
            self.assertEqual(manifest["previous_record"], str(first))
            self.assertIn("route_google", manifest["commands"])
            self.assertIn("route_to_8_8_8_8", manifest["facts"])
            self.assertEqual(manifest["commands"]["ping_gateway"]["status"], "skipped")
            self.assertIn("missing-home", (second / "SUMMARY.md").read_text())
            self.assertEqual(os.stat(second).st_mode & 0o777, 0o700)


if __name__ == "__main__":
    unittest.main()
