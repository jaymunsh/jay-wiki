#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ci_scope", Path(__file__).with_name("ci-scope.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ScopeTests(unittest.TestCase):
    def test_content_only_skips_builds(self):
        result = module.scope(["posts/jay-blog/drafts/new.md", "docs/design.md", "README.md"])
        self.assertEqual(result["images"], [])
        self.assertFalse(result["web"])
        self.assertFalse(result["spring"])

    def test_web_changes_select_web_image_and_node(self):
        result = module.scope(["web/src/middleware.ts"])
        self.assertEqual(result["images"], ["web"])
        self.assertTrue(result["web"])
        self.assertTrue(result["node"])
        self.assertFalse(result["spring"])

    def test_backend_changes_keep_editorial_integration(self):
        result = module.scope(["spring/src/main/java/Auth.java"])
        self.assertTrue(result["web"])
        self.assertTrue(result["spring"])
        self.assertEqual(result["images"], ["spring"])

    def test_service_changes_do_not_select_other_services(self):
        result = module.scope(["services/payment-api/uv.lock"])
        self.assertTrue(result["payment"])
        self.assertFalse(result["shipping"])
        self.assertEqual(result["python"], ["payment-api"])
        self.assertEqual(result["images"], ["services/payment-api"])

    def test_shared_and_unknown_changes_select_everything(self):
        for path in ["scripts/ci-scope.py", ".github/workflows/ci.yml",
                     "infra/k8s/app.yaml", "docker-compose.dev.yml", "new-app/main.py"]:
            with self.subTest(path=path):
                self.assertEqual(len(module.scope([path])["images"]), 5)

    def test_schedule_and_manual_full_scan(self):
        result = module.scope([], full=True)
        self.assertEqual(len(result["images"]), 5)
        self.assertEqual(len(result["python"]), 3)

    def test_entire_pr_and_move_out_of_component(self):
        # Earlier PR commits and deleted source paths must remain in the selection.
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(["git", "-C", directory, *args]).decode().strip()
            git("init", "-q")
            git("config", "user.email", "test@example.invalid")
            git("config", "user.name", "Test")
            root = Path(directory)
            (root / "web").mkdir()
            (root / "web/file.txt").write_text("sample")
            git("add", ".")
            git("commit", "-qm", "base")
            base = git("rev-parse", "HEAD")
            (root / "docs").mkdir()
            git("mv", "web/file.txt", "docs/file.txt")
            git("commit", "-qm", "move")
            (root / "README.md").write_text("later commit")
            git("add", ".")
            git("commit", "-qm", "docs")
            with unittest.mock.patch.object(module.subprocess, "check_output",
                 wraps=lambda args: subprocess.run(
                     args, cwd=directory, check=True, stdout=subprocess.PIPE
                 ).stdout):
                paths = module.changed_paths(base, "HEAD")
            self.assertIn("web/file.txt", paths)
            self.assertIn("README.md", paths)
            self.assertTrue(module.scope(paths)["web"])


if __name__ == "__main__":
    import unittest.mock
    unittest.main()
