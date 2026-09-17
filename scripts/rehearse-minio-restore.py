#!/usr/bin/env python3
"""Restore a raw wiki-assets archive in isolated MinIO and read every object.

No production connection or published host port. Requires Docker and the source
MinIO image (override --image when the backup was made by another version).
"""
import argparse
import hashlib
import io
import zipfile
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import tarfile
import tempfile
import time


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--image", default="quay.io/minio/minio:RELEASE.2024-12-18T13-15-44Z")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--logical", action="store_true", help="Restore objects.tar produced by pull-minio-objects.sh")
    parser.add_argument("--configuration-age", type=Path)
    parser.add_argument("--age-identity", type=Path)
    parser.add_argument("--app-jar", type=Path)
    parser.add_argument("--database-dump", type=Path)
    args = parser.parse_args()
    if args.app_jar and (not args.database_dump or not args.configuration_age):
        parser.error("App restore requires database dump and encrypted MinIO configuration")
    if args.configuration_age and not args.age_identity:
        parser.error("--age-identity is required for encrypted configuration")
    name = "jaywiki-minio-drill-" + secrets.token_hex(5)
    mc_image = "minio/mc:RELEASE.2025-04-08T15-39-49Z"
    start = time.monotonic()
    # Disposable credentials are unrelated to production.
    env = "MC_HOST_drill=http://drilladmin:local-drill-only-password@127.0.0.1:9000"
    with tempfile.TemporaryDirectory(prefix=name) as work:
        config_dir = Path(work) / "configuration"
        config_dir.mkdir(mode=0o700)
        app_user = None
        if args.configuration_age:
            encrypted = subprocess.check_output(["age", "-d", "-i", str(args.age_identity), str(args.configuration_age)])
            with tarfile.open(fileobj=io.BytesIO(encrypted)) as archive:
                for member in archive.getmembers():
                    if not member.isfile():
                        continue
                    filename = Path(member.name).name
                    if filename not in ("source-iam-info.zip", "source-bucket-metadata.zip", "server-config.txt", "versions.jsonl", ".complete"):
                        raise ValueError("Unexpected MinIO configuration entry")
                    payload = archive.extractfile(member).read()
                    (config_dir / filename).write_bytes(payload)
                    if filename.endswith(".zip"):
                        with zipfile.ZipFile(io.BytesIO(payload)) as zipped:
                            if zipped.testzip() is not None:
                                raise ValueError("Invalid configuration ZIP")
                            if "iam-info" in filename:
                                users = json.loads(zipped.read("iam-assets/users.json"))
                                app_user = users["jaywiki-wiki-assets"]
            if app_user is None:
                raise ValueError("Application IAM recovery entry missing")
            (config_dir / "config.json").write_text(json.dumps({"version":"10", "aliases":{"app":{
                "url":"http://127.0.0.1:9000", "accessKey":"jaywiki-wiki-assets", "secretKey":app_user["secretKey"], "api":"S3v4", "path":"auto"}}}))
        data = Path(work) / "data"
        source_dir = Path(work) / "source" if args.logical else data
        data.mkdir()
        source_dir.mkdir(exist_ok=True)
        with tarfile.open(args.archive) as archive:
            for member in archive.getmembers():
                path = Path(member.name)
                if (path.is_absolute() or ".." in path.parts
                        or (not args.logical and (not path.parts or path.parts[0] != "wiki-assets"))
                        or not (member.isfile() or member.isdir())):
                    raise ValueError("Archive contains an unexpected path or file type")
            # Explicit extraction also supports macOS Python 3.9, without trusting
            # archive permissions, owners, links, or special file types.
            for member in archive.getmembers():
                target = source_dir / member.name
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(member) as source, target.open("xb") as dest:
                        shutil.copyfileobj(source, dest)
        try:
            run("docker", "run", "-d", "--name", name, "--network", "none",
                "-e", "MINIO_ROOT_USER=drilladmin", "-e", "MINIO_ROOT_PASSWORD=local-drill-only-password",
                "-v", f"{data}:/data", args.image, "server", "/data",
                stdout=subprocess.DEVNULL)

            def mc(*command):
                return ["docker", "run", "--rm", "--network", f"container:{name}",
                        "-e", env, "-v", f"{source_dir}:/backup:ro", "-v", f"{config_dir}:/restore", mc_image, *command]

            deadline = time.monotonic() + 90
            while True:
                probe = subprocess.run(mc("ready", "drill"), capture_output=True)
                if probe.returncode == 0:
                    break
                if time.monotonic() >= deadline:
                    raise RuntimeError("Isolated MinIO failed readiness")
                time.sleep(1)
            if args.logical:
                for bucket in sorted(source_dir.iterdir()):
                    if bucket.is_dir():
                        run(*mc("mb", "drill/" + bucket.name), stdout=subprocess.DEVNULL)
                        run(*mc("mirror", "--quiet", "/backup/" + bucket.name, "drill/" + bucket.name), stdout=subprocess.DEVNULL)
            if args.configuration_age:
                run(*mc("admin", "cluster", "bucket", "import", "drill", "/restore/source-bucket-metadata.zip"), capture_output=True)
                run(*mc("admin", "cluster", "iam", "import", "drill", "/restore/source-iam-info.zip"), capture_output=True)
                run(*mc("admin", "user", "info", "drill", "jaywiki-wiki-assets"), capture_output=True)
            root = "drill" if args.logical else "drill/wiki-assets"
            listing = run(*mc("ls", "--recursive", "--json", root), capture_output=True, text=True)
            objects = [json.loads(line) for line in listing.stdout.splitlines() if line.strip()]
            records = []
            for obj in objects:
                if obj.get("status") != "success":
                    raise RuntimeError("MinIO listing failed")
                if obj.get("type") != "file":
                    continue
                digest = hashlib.sha256()
                size = 0
                with subprocess.Popen(mc("cat", root + "/" + obj["key"]), stdout=subprocess.PIPE) as reader:
                    while chunk := reader.stdout.read(1024 * 1024):
                        digest.update(chunk)
                        size += len(chunk)
                    if reader.wait() != 0:
                        raise RuntimeError("Restored object cannot be read")
                if size != obj["size"]:
                    raise RuntimeError("Restored object size differs from listing")
                if args.logical and digest.hexdigest() != hashlib.sha256((source_dir / obj["key"]).read_bytes()).hexdigest():
                    raise RuntimeError("Restored bytes differ from backup")
                records.append({"key": obj["key"], "bytes": size, "sha256": digest.hexdigest()})
            if not records:
                raise RuntimeError("No objects restored; refusing an empty success")
            if args.configuration_age:
                candidate = next(x for x in records if x["key"].startswith("wiki-assets/"))
                restored = run(*mc("--config-dir", "/restore", "cat", "app/" + candidate["key"]), capture_output=True).stdout
                if hashlib.sha256(restored).hexdigest() != candidate["sha256"]:
                    raise RuntimeError("Restored application credentials cannot read the original object bytes")
                denied = subprocess.run(mc("--config-dir", "/restore", "ls", "app/backups"), capture_output=True)
                if denied.returncode == 0:
                    raise RuntimeError("Restored application credentials unexpectedly access backup bucket")
            report = {"image": args.image, "archiveSha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
                      "iamAndBucketConfigurationRestored": bool(args.configuration_age), "applicationObjectReadAndBackupDenial": bool(args.configuration_age),
                      "objects": records, "count": len(records), "bytes": sum(x["bytes"] for x in records),
                      "elapsedSeconds": round(time.monotonic() - start, 1),
                      "scope": "logical current objects: restore and byte comparison" if args.logical else "raw wiki-assets restore and full object reads; no app or other bucket verification"}
            if args.app_jar:
                import importlib.util
                spec = importlib.util.spec_from_file_location("restored_app", Path(__file__).with_name("rehearse-restored-app.py"))
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                report["applicationRecovery"] = module.verify(name, config_dir, args.app_jar, args.database_dump)
                report["elapsedSeconds"] = round(time.monotonic() - start, 1)
            args.report.write_text(json.dumps(report, indent=2) + "\n")
            print(json.dumps({k: v for k, v in report.items() if k != "objects"}))
        finally:
            subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
