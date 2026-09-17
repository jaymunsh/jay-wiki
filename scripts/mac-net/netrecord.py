#!/usr/bin/python3
"""Read-only macOS incident collector. No dependencies, sudo, or uploads."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time

VERSION = "1.0.0"
LIMIT = 4 * 1024 * 1024
HOME = Path.home()
DEFAULT_ROOT = HOME / "netrecords"
PREDICATE = ('process == "configd" OR process == "nesessionmanager" OR '
             'process == "neagent" OR process == "mDNSResponder" OR '
             'process CONTAINS[c] "tailscale" OR process == "unicornprod" OR '
             'process == "UnicornProMac" OR '
             '(process == "kernel" AND eventMessage CONTAINS[c] "utun")')


def now():
    return dt.datetime.now().astimezone().isoformat(timespec="milliseconds")


def app_versions():
    versions = {}
    for name in ["UnicornProMac", "Tailscale"]:
        try:
            with Path("/Applications", name + ".app/Contents/Info.plist").open("rb") as stream:
                data = plistlib.load(stream)
            versions[name] = {"version": data.get("CFBundleShortVersionString"),
                              "build": data.get("CFBundleVersion")}
        except (OSError, ValueError, plistlib.InvalidFileException) as error:
            versions[name] = {"status": "unavailable", "error": str(error)}
    return versions


def write_json(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temp.replace(path)


def run_command(argv, timeout=8, limit=LIMIT):
    """Bound time and retained output; kill the entire child group on timeout."""
    start = now()
    begin = time.monotonic()
    code = None
    state = "ok"
    with tempfile.TemporaryFile() as output:
        try:
            process = subprocess.Popen(argv, stdout=output, stderr=subprocess.STDOUT,
                                       stdin=subprocess.DEVNULL, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
                if code:
                    state = "failed"
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                state = "timeout"
        except OSError as error:
            output.write(str(error).encode())
            state = "unavailable"
        size = output.seek(0, 2)
        output.seek(max(0, size - limit))
        text = output.read().decode("utf-8", errors="replace")
    return {"command": argv, "started_at": start, "ended_at": now(),
            "duration_seconds": round(time.monotonic() - begin, 3),
            "exit_code": code, "status": state,
            "truncated": size > limit, "original_bytes": size}, text


def copy_tail(source, target, limit=LIMIT):
    item = {"source": str(source), "captured_at": now(), "file": str(target.name)}
    try:
        with source.open("rb") as stream:
            stat = os.fstat(stream.fileno())
            stream.seek(max(0, stat.st_size - limit))
            data = stream.read(limit)
        target.write_bytes(data)
        item.update(status="ok", source_bytes=stat.st_size,
                    source_mtime_ns=stat.st_mtime_ns, truncated=stat.st_size > limit,
                    sha256=hashlib.sha256(data).hexdigest())
    except OSError as error:
        item.update(status="unavailable", error=str(error))
    return item


def fields(text):
    return dict(re.findall(r"^\s*(gateway|interface|destination|mask):\s*(.+)$", text, re.M))


def gateway_address(text):
    value = fields(text).get("gateway", "")
    try:
        return str(ipaddress.IPv4Address(value))
    except ValueError:
        return None


def route_lines(text):
    return [" ".join(line.split()) for line in text.splitlines()
            if re.match(r"^(default|0/2|64/2|128\.0/2|192\.0\.0/2)\s", line)]


def facts_from(results, texts):
    probes = {name: data["status"] for name, data in results.items()
              if name.startswith(("ping_", "https_"))}
    return {"route_to_1_1_1_1": fields(texts.get("route_public", "")),
            "route_to_8_8_8_8": fields(texts.get("route_google", "")),
            "default_route": fields(texts.get("route_default", "")),
            "quarter_and_default_routes": route_lines(texts.get("routes_v4", "")),
            "probes": probes}


def previous_record(root, current):
    for directory in sorted(root.iterdir(), reverse=True):
        if directory == current or not directory.is_dir():
            continue
        try:
            data = json.loads((directory / "manifest.json").read_text())
            if data.get("complete") and data.get("facts"):
                return directory, data
        except (OSError, ValueError):
            continue
    return None, None


def summary(manifest, previous_path=None, previous=None):
    facts = manifest.get("facts", {})
    lines = ["# 네트워크 기록", "", "- 기록 시각: " + manifest["started_at"],
             "- 종류: " + manifest["tag"], "- 도구 버전: " + VERSION,
             "- 사용자 메모: " + (manifest["note"] or "없음"),
             "- 완료 여부: " + str(manifest["complete"]), "",
             "- 앱 버전: " + json.dumps(manifest.get("app_versions", {}), ensure_ascii=False), "",
             "## 관찰값", "", "```json", json.dumps(facts, ensure_ascii=False, indent=2), "```", "",
             "## 직전 완료 기록과 비교", ""]
    if previous:
        lines += [str(previous_path), "", "직전 종류: " + previous["tag"]]
        changes = [key for key in facts if facts[key] != previous["facts"].get(key)]
        for key in changes:
            lines += ["", "### " + key, "", "이전:", "```json",
                      json.dumps(previous["facts"].get(key), ensure_ascii=False, indent=2),
                      "```", "현재:", "```json", json.dumps(facts[key], ensure_ascii=False, indent=2), "```"]
        if not changes:
            lines += ["", "요약 관찰값은 같다. 내부 로그와 시간 범위는 별도로 비교해야 한다."]
    else:
        lines += ["이전 완료 기록 없음. 정상 상태에서 netrecord ok를 실행해 비교 자료를 남긴다."]
    lines += ["", "## 다음 조사자가 읽는 순서", "",
              "1. manifest.json의 tag·note·시각과 SUMMARY.md 비교 결과를 확인한다.",
              "2. route_public.txt, route_google.txt, routes_v4.txt, interfaces.txt로 두 외부 목적지의 경로와 터널 주소를 연결한다.",
              "3. ping/HTTPS 결과를 각각 확인한다. 한 검사만으로 인터넷 전체를 판정하지 않는다.",
              "4. unicorn/ 사본과 system_log.txt를 시간순으로 대조한다. tailscale.txt 오류만으로 원인을 단정하지 않는다.",
              "5. down과 after 사이 사용자가 한 조치 및 정상 ok 기록을 비교한다. 직전 기록이 정상 대조군이라는 보장은 없다.",
              "", "각 명령은 순차 또는 병렬 실행되므로 원자적인 순간 캡처가 아니다. 개별 시각을 사용한다.",
              "프로브는 외부에 소량의 ping/HTTPS 요청을 보낸다. 라우팅·VPN·DNS 설정은 변경하지 않는다.",
              "수집 실패·시간 초과는 장애 증명과 다르다. 아래 누락과 manifest.json의 절단 여부를 확인한다.",
              "", "## 실패하거나 수집하지 못한 항목", ""]
    issues = [name + ": " + item["status"] for name, item in manifest["commands"].items()
              if item["status"] != "ok"]
    issues += [item["source"] + ": " + item["status"] for item in manifest["copied_logs"]
               if item["status"] != "ok"]
    lines += ["- " + issue for issue in issues] or ["없음"]
    lines += ["", "원본에는 IP·기기명·접속 대상이 포함될 수 있다. 로컬 보관용이며 자동 업로드하지 않는다.", ""]
    return "\n".join(lines)


def collect(tag, root, note=""):
    os.umask(0o077)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = dt.datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
    out = root / (stamp + "-" + tag)
    out.mkdir(mode=0o700)
    (out / "unicorn").mkdir(mode=0o700)
    manifest = {"schema_version": 1, "tool_version": VERSION, "tag": tag,
                "note": note, "started_at": now(), "complete": False,
                "app_versions": app_versions(),
                "commands": {}, "copied_logs": []}
    write_json(out / "manifest.json", manifest)
    print("수집 시작: " + str(out), file=sys.stderr, flush=True)
    results, texts = manifest["commands"], {}

    def execute(name, command, timeout=8, transform=None):
        result, text = run_command(command, timeout)
        if transform:
            text = transform(text)
        filename = name + ".txt"
        (out / filename).write_text(text)
        result["file"] = filename
        return name, result, text

    def save(record):
        name, result, text = record
        results[name], texts[name] = result, text
        manifest["facts"] = facts_from(results, texts)
        write_json(out / "manifest.json", manifest)

    # Capture volatile routing and vendor files before doing any active probing.
    for name, command in [
        ("routes_v4", ["/usr/sbin/netstat", "-nr", "-f", "inet"]),
        ("route_public", ["/sbin/route", "-n", "get", "1.1.1.1"]),
        ("route_google", ["/sbin/route", "-n", "get", "8.8.8.8"]),
        ("route_default", ["/sbin/route", "-n", "get", "default"]),
        ("interfaces", ["/sbin/ifconfig"]),
    ]:
        save(execute(name, command, 3))
    vendor = HOME / "Library/Application Support/Unicorn Pro/rel/sl"
    for name in ["vpn.log", "vpn-1.log", "netstat.log", "netstat-1.log", "system.log"]:
        manifest["copied_logs"].append(copy_tail(vendor / name, out / "unicorn" / name))
    manifest["copied_logs"].append(copy_tail(HOME / "fixnet.log", out / "fixnet.log"))
    (out / "SUMMARY.md").write_text(summary(manifest))
    write_json(out / "manifest.json", manifest)

    end = dt.datetime.now().astimezone()
    start = end - dt.timedelta(minutes=15)
    manifest["system_log_window"] = {"start": start.isoformat(), "end": end.isoformat()}
    jobs = [
        ("os_version", ["/usr/bin/sw_vers"], 3, None),
        ("routes_v6", ["/usr/sbin/netstat", "-nr", "-f", "inet6"], 3, None),
        ("dns", ["/usr/sbin/scutil", "--dns"], 3, None),
        ("network_state", ["/usr/sbin/scutil", "--nwi"], 3, None),
        ("proxy", ["/usr/sbin/scutil", "--proxy"], 3, None),
        ("vpn_services", ["/usr/sbin/scutil", "--nc", "list"], 3, None),
        ("dhcp_en0", ["/usr/sbin/ipconfig", "getpacket", "en0"], 3, None),
        ("processes", ["/bin/ps", "-axo", "pid,lstart,comm"], 3,
         lambda text: "\n".join(line for line in text.splitlines()
                                if re.search(r"tailscale|unicorn|configd|nesessionmanager", line, re.I)) + "\n"),
        ("ping_cloudflare", ["/sbin/ping", "-c", "2", "-W", "1000", "1.1.1.1"], 4, None),
        ("ping_google", ["/sbin/ping", "-c", "2", "-W", "1000", "8.8.8.8"], 4, None),
        ("system_log", ["/usr/bin/log", "show", "--start", start.strftime("%Y-%m-%d %H:%M:%S"),
                        "--end", end.strftime("%Y-%m-%d %H:%M:%S"), "--style", "compact", "--info",
                        "--predicate", PREDICATE], 20, None),
    ]
    for name, url in [("https_apple", "https://www.apple.com/"),
                      ("https_cloudflare_ip", "https://1.1.1.1/")]:
        jobs.append((name, ["/usr/bin/curl", "-q", "--noproxy", "*", "-4", "-sS", "--fail",
                           "--connect-timeout", "3", "--max-time", "6", "-o", "/dev/null",
                           "-w", "http=%{http_code} remote=%{remote_ip} time=%{time_total}\n", url], 8, None))
    gateway = gateway_address(texts.get("route_default", ""))
    if gateway:
        jobs.append(("ping_gateway", ["/sbin/ping", "-c", "2", "-W", "1000", gateway], 4, None))
    else:
        results["ping_gateway"] = {"status": "skipped", "reason": "default gateway is not an IPv4 address"}
    tailscale = shutil.which("tailscale") or "/usr/local/bin/tailscale"
    jobs += [("tailscale", [tailscale, "status"], 5, None),
             ("tailscale_netcheck", [tailscale, "netcheck"], 8, None),
             ("tailscale_prefs", [tailscale, "debug", "prefs"], 5, filtered_prefs)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(execute, *job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            save(future.result())
    manifest.update(complete=True, ended_at=now(), facts=facts_from(results, texts))
    previous_path, previous = previous_record(root, out)
    manifest["previous_record"] = str(previous_path) if previous_path else None
    write_json(out / "manifest.json", manifest)
    (out / "SUMMARY.md").write_text(summary(manifest, previous_path, previous))
    print(str(out), flush=True)
    print("요약: " + str(out / "SUMMARY.md"), file=sys.stderr, flush=True)
    return out


def filtered_prefs(text):
    # Never persist raw preferences: they may contain persisted identity material.
    try:
        data = json.loads(text)
        return json.dumps({key: data.get(key) for key in
                           ["RouteAll", "ExitNodeID", "ExitNodeIP", "WantRunning", "CorpDNS"]}, indent=2) + "\n"
    except (ValueError, AttributeError):
        return "Preferences unavailable or unparseable; raw output was not saved.\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", choices=["ok", "down", "after", "manual"], nargs="?", default="manual")
    parser.add_argument("--note", default="", help="Observed symptom or action taken; stored verbatim")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--version", action="version", version=VERSION)
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("This collector requires macOS")
    collect(args.tag, args.output_root.expanduser().resolve(), args.note)


if __name__ == "__main__":
    main()
