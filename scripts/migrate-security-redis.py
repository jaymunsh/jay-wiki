#!/usr/bin/env python3
"""Copy only expiring security strings, preserving remaining TTL across Redis versions.

Default is a read-only inventory. --write requires every application writer to be
stopped first. Passwords are read from files via SOURCE_PASSWORD_FILE and
TARGET_PASSWORD_FILE, never command arguments. Source keys are never deleted.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import time

PREFIXES = (b"auth:admin:totp:attempts:", b"auth:admin:totp:used:",
            b"board:write:rate:", b"auth:jwt:revoked:")
SNAPSHOT = b"local v=redis.call('GET',KEYS[1]); if not v then return {} end; return {v,redis.call('PTTL',KEYS[1])}"
# Idempotent reruns do not shorten target protection. Conflicting values fail.
INSTALL = b"local v=redis.call('GET',KEYS[1]); if v and v~=ARGV[1] then return -1 end; if v then local t=redis.call('PTTL',KEYS[1]); if t<0 then return -2 end; if t<tonumber(ARGV[2]) then redis.call('PEXPIRE',KEYS[1],ARGV[2]) end; return 0 end; redis.call('SET',KEYS[1],ARGV[1],'PX',ARGV[2]); return 1"


class Redis:
    def __init__(self, host, port, db, password_file=None):
        self.socket = socket.create_connection((host, port), timeout=5)
        self.stream = self.socket.makefile("rb")
        try:
            if password_file:
                self.command(b"AUTH", Path(password_file).read_bytes().rstrip(b"\r\n"))
            self.command(b"SELECT", db)
        except Exception:
            self.close()
            raise

    def read(self):
        line = self.stream.readline()
        if not line.endswith(b"\r\n"):
            raise RuntimeError("Invalid Redis response")
        kind, value = line[:1], line[1:-2]
        if kind == b"-":
            raise RuntimeError("Redis rejected a command (details suppressed)")
        if kind == b"+":
            return value
        if kind == b":":
            return int(value)
        if kind == b"$":
            size = int(value)
            if size == -1:
                return None
            if size < 0 or size > 1024 * 1024:
                raise RuntimeError("Unexpected Redis value size")
            data = self.stream.read(size)
            if len(data) != size or self.stream.read(2) != b"\r\n":
                raise RuntimeError("Truncated Redis value")
            return data
        if kind == b"*":
            count = int(value)
            if count < 0 or count > 100000:
                raise RuntimeError("Unexpected Redis response count")
            return [self.read() for _ in range(count)]
        raise RuntimeError("Unsupported Redis response")

    def command(self, *args):
        args = [arg if isinstance(arg, bytes) else str(arg).encode() for arg in args]
        self.socket.sendall(b"*%d\r\n" % len(args) + b"".join(b"$%d\r\n" % len(a) + a + b"\r\n" for a in args))
        return self.read()

    def close(self):
        self.stream.close()
        self.socket.close()


def migrate(source, target=None):
    snapshots, seen = [], set()
    for prefix in PREFIXES:
        cursor = b"0"
        while True:
            cursor, keys = source.command("SCAN", cursor, "MATCH", prefix + b"*", "COUNT", 100)
            for key in keys:
                if key in seen:
                    continue
                seen.add(key)
                if len(seen) > 100000:
                    raise RuntimeError("Unexpected security key count")
                started = time.monotonic()
                result = source.command("EVAL", SNAPSHOT, 1, key)
                if not result:
                    continue
                value, ttl = result
                if ttl < 0:
                    raise RuntimeError("Security key has no expiry; manual investigation required")
                snapshots.append((key, value, ttl, started))
            if cursor == b"0":
                break
    report = {"mode": "write" if target else "inventory", "observed": len(snapshots), "copied": 0, "alreadyPresent": 0, "expired": 0}
    ttls = [s[2] for s in snapshots]
    report.update(ttlMinMs=min(ttls, default=0), ttlMaxMs=max(ttls, default=0))
    if target:
        for key, value, ttl, started in snapshots:
            remaining = ttl - int((time.monotonic() - started) * 1000) - 1
            if remaining <= 0:
                report["expired"] += 1
                continue
            result = target.command("EVAL", INSTALL, 1, key, value, remaining)
            if result < 0:
                raise RuntimeError("Target key conflicts or has no expiry; source retained, some keys may already be copied")
            report["copied" if result else "alreadyPresent"] += 1
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-host", required=True)
    parser.add_argument("--source-port", type=int, default=6379)
    parser.add_argument("--source-db", type=int, default=0)
    parser.add_argument("--target-host")
    parser.add_argument("--target-port", type=int, default=6379)
    parser.add_argument("--target-db", type=int, default=0)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--writers-stopped", action="store_true")
    args = parser.parse_args()
    if args.write and (not args.writers_stopped or not args.target_host):
        parser.error("Writing requires --writers-stopped and --target-host")
    source = Redis(args.source_host, args.source_port, args.source_db, os.environ.get("SOURCE_PASSWORD_FILE"))
    target = None
    try:
        if args.write:
            target = Redis(args.target_host, args.target_port, args.target_db, os.environ.get("TARGET_PASSWORD_FILE"))
        print(json.dumps(migrate(source, target)))
    finally:
        source.close()
        if target:
            target.close()


if __name__ == "__main__":
    main()
