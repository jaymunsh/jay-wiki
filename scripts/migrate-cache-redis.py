#!/usr/bin/env python3
"""Migrate the string/set types observed in production, with TTL and source retained.

Requires stopped writers and an empty destination for non-security cache keys.
Security prefixes are deliberately excluded and use migrate-security-redis.py.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location("security_migration", Path(__file__).with_name("migrate-security-redis.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SNAPSHOT = "local t=redis.call('TYPE',KEYS[1]).ok; if t=='none' then return {} end; if t=='string' then return {t,redis.call('PTTL',KEYS[1]),redis.call('GET',KEYS[1])} end; if t=='set' then return {t,redis.call('PTTL',KEYS[1]),redis.call('SMEMBERS',KEYS[1])} end; return redis.error_reply('Unsupported cache type')"
INSTALL = "if redis.call('EXISTS',KEYS[1])~=0 then return -1 end; if ARGV[1]=='string' then redis.call('SET',KEYS[1],ARGV[3]) else for i=3,#ARGV do redis.call('SADD',KEYS[1],ARGV[i]) end end; if tonumber(ARGV[2])>=0 then redis.call('PEXPIRE',KEYS[1],ARGV[2]) end; return 1"


def migrate(source, target):
    seen, snapshots = set(), []
    cursor = b"0"
    while True:
        cursor, keys = source.command("SCAN", cursor, "COUNT", 100)
        for key in keys:
            if key in seen or key.startswith(module.PREFIXES):
                continue
            seen.add(key)
            if len(seen) > 10000:
                raise RuntimeError("Unexpected cache key count")
            start = time.monotonic()
            value = source.command("EVAL", SNAPSHOT, 1, key)
            if value:
                snapshots.append((key, value, start))
        if cursor == b"0":
            break
    report = {"observed": len(snapshots), "copied": 0, "expired": 0}
    for key, (kind, ttl, value), start in snapshots:
        if ttl == -2:
            report["expired"] += 1
            continue
        remaining = ttl if ttl == -1 else ttl - int((time.monotonic() - start) * 1000) - 1
        if ttl >= 0 and remaining <= 0:
            report["expired"] += 1
            continue
        values = [value] if kind == b"string" else value
        result = target.command("EVAL", INSTALL, 1, key, kind, remaining, *values)
        if result != 1:
            raise RuntimeError("Cache target conflict; source retained and partial copies may exist")
        report["copied"] += 1
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-host", required=True)
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--writers-stopped", action="store_true", required=True)
    args = parser.parse_args()
    source = module.Redis(args.source_host, 6379, 0, os.environ.get("SOURCE_PASSWORD_FILE"))
    target = None
    try:
        target = module.Redis(args.target_host, 6379, 0, os.environ.get("TARGET_PASSWORD_FILE"))
        print(json.dumps(migrate(source, target)))
    finally:
        source.close()
        if target:
            target.close()


if __name__ == "__main__":
    main()
