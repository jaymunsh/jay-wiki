#!/usr/bin/env python3
"""Stream a SQLite k3s recovery archive; MUST pipe directly into encryption.

Run in the short-lived, read-only host inspection pod. No host files are modified.
The output contains secrets. Never run with stdout attached to a terminal/log.
"""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tarfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/host"))
    parser.add_argument("--scratch", type=Path, default=Path("/scratch"))
    args = parser.parse_args()
    if sys.stdout.isatty():
        raise RuntimeError("Refusing to print a recovery archive to a terminal")
    server = args.root / "var/lib/rancher/k3s/server"
    database = server / "db/state.db"
    token = server / "token"
    if not database.is_file() or not token.is_file() or (server / "db/etcd").exists():
        raise RuntimeError("Expected SQLite datastore and server token; refusing a partial or wrong datastore backup")
    target = args.scratch / "state.db"
    if target.exists():
        raise RuntimeError("Scratch snapshot already exists")
    deadline = time.monotonic() + 180
    def progress(status, remaining, total):
        if time.monotonic() >= deadline:
            raise TimeoutError("SQLite snapshot exceeded its deadline")
    with closing(sqlite3.connect(f"file:{database}?mode=ro", uri=True)) as source:
        with closing(sqlite3.connect(target)) as dest:
            source.backup(dest, pages=256, progress=progress)
            if dest.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                raise RuntimeError("Snapshot integrity check failed")
            dest.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            if dest.execute("PRAGMA journal_mode=DELETE").fetchone()[0] != "delete":
                raise RuntimeError("Snapshot still requires a WAL sidecar")
    paths = ["var/lib/rancher/k3s/server/token", "var/lib/rancher/k3s/server/cred",
             "var/lib/rancher/k3s/server/tls", "var/lib/rancher/k3s/server/manifests",
             "etc/rancher/k3s", "etc/systemd/system/k3s.service",
             "etc/systemd/system/k3s.service.env", "etc/systemd/system/k3s.service.d"]
    try:
        with tarfile.open(fileobj=sys.stdout.buffer, mode="w|") as archive:
            archive.add(target, arcname="var/lib/rancher/k3s/server/db/state.db")
            for path in paths:
                source = args.root / path
                if source.exists():
                    archive.add(source, arcname=path)
    finally:
        target.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
