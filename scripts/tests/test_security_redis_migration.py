"""Integration checks against a disposable Redis, with no production connection."""
import importlib.util
import json
from pathlib import Path
import subprocess
import time
import unittest
import uuid

spec = importlib.util.spec_from_file_location("migration", Path(__file__).resolve().parents[1] / "migrate-security-redis.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
cache_spec = importlib.util.spec_from_file_location("cache_migration", Path(__file__).resolve().parents[1] / "migrate-cache-redis.py")
cache_migration = importlib.util.module_from_spec(cache_spec)
cache_spec.loader.exec_module(cache_migration)


class MigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = "redis-migration-test-" + uuid.uuid4().hex[:10]
        subprocess.run(["docker", "run", "-d", "--name", cls.container, "-p", "127.0.0.1::6379", "redis:7.4-alpine"], check=True, stdout=subprocess.DEVNULL)
        cls.addClassCleanup(lambda: subprocess.run(["docker", "rm", "-f", cls.container], stdout=subprocess.DEVNULL))
        info = json.loads(subprocess.check_output(["docker", "inspect", cls.container]))[0]
        cls.port = int(info["NetworkSettings"]["Ports"]["6379/tcp"][0]["HostPort"])
        deadline = time.monotonic() + 30
        while True:
            try:
                probe = migration.Redis("127.0.0.1", cls.port, 0)
                probe.close()
                break
            except (OSError, RuntimeError):
                if time.monotonic() > deadline:
                    raise
                time.sleep(0.2)

    def setUp(self):
        self.source = migration.Redis("127.0.0.1", self.port, 0)
        self.target = migration.Redis("127.0.0.1", self.port, 1)
        self.addCleanup(self.source.close)
        self.addCleanup(self.target.close)
        self.source.command("FLUSHDB")
        self.target.command("FLUSHDB")
        self.key = b"auth:jwt:revoked:test"

    def test_copies_security_only_and_preserves_ttl(self):
        self.source.command("SET", self.key, "1", "PX", 10000)
        self.source.command("SET", "cache:article", "content")
        report = migration.migrate(self.source, self.target)
        self.assertEqual(report["copied"], 1)
        self.assertEqual(self.target.command("GET", self.key), b"1")
        self.assertIsNone(self.target.command("GET", "cache:article"))
        self.assertTrue(0 < self.target.command("PTTL", self.key) <= 10000)
        self.assertEqual(self.source.command("GET", self.key), b"1")

    def test_inventory_does_not_write(self):
        self.source.command("SET", self.key, "1", "PX", 10000)
        self.assertEqual(migration.migrate(self.source)["observed"], 1)
        self.assertEqual(self.target.command("DBSIZE"), 0)

    def test_conflict_is_not_overwritten(self):
        self.source.command("SET", self.key, "1", "PX", 10000)
        self.target.command("SET", self.key, "different", "PX", 10000)
        with self.assertRaises(RuntimeError):
            migration.migrate(self.source, self.target)
        self.assertEqual(self.target.command("GET", self.key), b"different")

    def test_missing_expiry_fails_before_copy(self):
        self.source.command("SET", self.key, "1")
        with self.assertRaises(RuntimeError):
            migration.migrate(self.source, self.target)
        self.assertEqual(self.target.command("DBSIZE"), 0)

    def test_rerun_does_not_shorten_existing_protection(self):
        self.source.command("SET", self.key, "1", "PX", 10000)
        self.target.command("SET", self.key, "1", "PX", 20000)
        report = migration.migrate(self.source, self.target)
        self.assertEqual(report["alreadyPresent"], 1)
        self.assertGreater(self.target.command("PTTL", self.key), 15000)

    def test_cache_set_and_persistent_counter_are_preserved(self):
        self.source.command("SADD", "cache:visitors", "one", "two")
        self.source.command("PEXPIRE", "cache:visitors", 10000)
        self.source.command("SET", "cache:count", "42")
        self.source.command("SET", self.key, "1", "PX", 10000)
        result = cache_migration.migrate(self.source, self.target)
        self.assertEqual(result["copied"], 2)
        self.assertEqual(set(self.target.command("SMEMBERS", "cache:visitors")), {b"one", b"two"})
        self.assertTrue(0 < self.target.command("PTTL", "cache:visitors") <= 10000)
        self.assertEqual(self.target.command("GET", "cache:count"), b"42")
        self.assertEqual(self.target.command("PTTL", "cache:count"), -1)
        self.assertIsNone(self.target.command("GET", self.key))
        self.assertEqual(self.source.command("SCARD", "cache:visitors"), 2)

    def test_cache_unexpected_type_aborts_before_writing(self):
        self.source.command("HSET", "cache:unexpected", "field", "value")
        with self.assertRaises(RuntimeError):
            cache_migration.migrate(self.source, self.target)
        self.assertEqual(self.target.command("DBSIZE"), 0)

    def test_cache_conflict_retains_both_values(self):
        self.source.command("SET", "cache:count", "42")
        self.target.command("SET", "cache:count", "99")
        with self.assertRaises(RuntimeError):
            cache_migration.migrate(self.source, self.target)
        self.assertEqual(self.target.command("GET", "cache:count"), b"99")
        self.assertEqual(self.source.command("GET", "cache:count"), b"42")


if __name__ == "__main__":
    unittest.main()
