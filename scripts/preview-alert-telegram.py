#!/usr/bin/env python3
"""알림이 텔레그램에 어떤 글자로 도착하는지 폰을 울리지 않고 본다.

왜 있나 — 규칙 파일에 한글 문구를 정성껏 써 놔도 Alertmanager 템플릿이 그것을
안 읽으면 한 글자도 안 실린다. 실제로 summary/description 넷이 그렇게 빠져 있었고,
그것을 알아낸 방법은 템플릿을 눈으로 읽은 것이었다. 문구를 쓴 것과 그 문구가
도착하는 것은 다른 일이라, 도착하는 쪽을 기계로 볼 수 있어야 한다.

어떻게 — 운영과 같은 Alertmanager 이미지를 로컬에 띄우되 텔레그램 API 주소만
로컬 스텁으로 돌린다. 그러면 sendMessage 본문에 렌더링된 진짜 문구가 그대로 온다.
설정과 문구는 저장소의 정본 파일에서 읽는다. 사본을 만들면 사본을 검사하게 된다.

    scripts/preview-alert-telegram.py                 # 규칙 전부
    scripts/preview-alert-telegram.py JaywikiApi5xxObserved
    scripts/preview-alert-telegram.py --list

이 스크립트는 클러스터에 접속하지 않는다. 운영에 아무 영향이 없다.
"""
from __future__ import annotations

import http.server
import json
import re
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
OBS = ROOT / "infra/k8s/observability"
AM_VALUES = OBS / "alertmanager-telegram-values.yaml"
RULE_FILES = [OBS / "prometheus-values.yaml", OBS / "loki-rules.yaml"]

IMAGE = "prom/alertmanager:v0.33.0"
STUB_PORT = 9099
AM_PORT = 9399
WORK = Path("/tmp/alert-preview")

# 시계열 라벨. 규칙마다 sum by(...) 가 다르고, 그 차이가 알림 문구를 가른다 —
# uri 가 있는지, status 가 있는지, pod 이 있는지에 따라 서로 다른 줄이 그려진다.
# 문구(summary/description)와 severity 는 여기 적지 않는다. 규칙 파일에서 읽는다.
SERIES_LABELS: dict[str, dict[str, str]] = {
    "JaywikiBackendDown": {"job": "jaywiki-backend", "instance": "10.42.0.31:8080"},
    "JaywikiApiP95High": {"job": "jaywiki-backend"},
    "JaywikiApi5xxHigh": {"job": "jaywiki-backend", "namespace": "backend", "service": "jaywiki-backend"},
    "JaywikiApi5xxObserved": {
        "method": "POST", "uri": "/api/wiki/featured", "status": "500",
        "service": "jaywiki-backend", "namespace": "backend",
    },
    "JaywikiApi400Observed": {
        "method": "POST", "uri": "/api/board/posts", "status": "400",
        "service": "jaywiki-backend", "namespace": "backend",
    },
    # status 라벨이 없다. 규칙이 sum by 에 status 를 안 담아서였고, 그래서 알림의
    # '에러코드' 칸이 비어 있었다. 규칙을 고쳤으므로 지금은 실려야 한다.
    "JaywikiAdminForbiddenSustained": {
        "method": "GET", "uri": "/api/admin/services", "status": "403",
        "service": "jaywiki-backend", "namespace": "backend",
    },
    "JaywikiPodRestartHigh": {"namespace": "backend", "pod": "jaywiki-backend-7c9f4d8b6-x2mn7"},
    "JaywikiKafkaDlqObserved": {"namespace": "backend"},
    "NodeMemoryHigh": {"instance": "minipc:9100"},
    "DiskAlmostFull": {"instance": "minipc:9100", "mountpoint": "/"},
    "JaywikiBackupJobFailed": {"namespace": "data", "job_name": "postgres-backup-29281440"},
    "JaywikiBackupNotRunning": {"namespace": "data"},
    "JaywikiApiErrorLogged": {
        "namespace": "backend", "pod": "jaywiki-backend-7c9f4d8b6-x2mn7",
        "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736", "status": "500",
        "method": "POST", "path": "/api/wiki/featured", "uri": "/api/wiki/featured",
    },
}

# 규칙의 annotations 는 Prometheus 가 먼저 렌더링해서 Alertmanager 로 보낸다.
# 여기서도 같은 자리에 값을 넣어야 실제로 도착하는 문장이 나온다.
VALUE_SAMPLE = "12"


def load_rules() -> dict[str, dict]:
    """정본 규칙 파일에서 alertname → {labels, annotations} 를 읽는다."""
    found: dict[str, dict] = {}
    for path in RULE_FILES:
        text = path.read_text(encoding="utf-8")
        for doc in yaml.safe_load_all(text):
            for rule in walk_rules(doc):
                found[rule["alert"]] = rule
        # loki-rules 는 ConfigMap 의 data 안에 YAML 이 문자열로 들어 있다.
        for embedded in re.findall(r"^\s{2}[\w.-]+\.yaml: \|\n((?:\s{4}.*\n|\n)+)", text, re.M):
            dedented = "\n".join(line[4:] for line in embedded.splitlines())
            for rule in walk_rules(yaml.safe_load(dedented)):
                found[rule["alert"]] = rule
    return found


def walk_rules(node) -> list[dict]:
    """중첩 구조 어디에 있든 alert 키를 가진 매핑을 전부 모은다."""
    out: list[dict] = []
    if isinstance(node, dict):
        if "alert" in node and isinstance(node.get("alert"), str):
            out.append(node)
        for value in node.values():
            out.extend(walk_rules(value))
    elif isinstance(node, list):
        for item in node:
            out.extend(walk_rules(item))
    return out


def render_annotation(text: str, labels: dict[str, str]) -> str:
    """Prometheus 가 하는 치환만 흉내 낸다. 없는 라벨은 빈 문자열이 된다 — 그게 사실이다."""
    text = re.sub(r"\{\{\s*\$labels\.(\w+)\s*\}\}", lambda m: labels.get(m.group(1), ""), text)
    return re.sub(r"\{\{\s*\$value[^}]*\}\}", VALUE_SAMPLE, text)


def build_config() -> dict:
    """정본 values 의 config 를 그대로 쓰되, 나가는 곳만 로컬 스텁으로 돌린다."""
    values = yaml.safe_load(AM_VALUES.read_text(encoding="utf-8"))
    cfg = dict(values["alertmanager"]["config"])
    cfg.pop("enabled", None)
    cfg.pop("templates", None)  # 외부 .tmpl 파일은 이 저장소에 없다

    for receiver in cfg["receivers"]:
        for tg in receiver.get("telegram_configs", []):
            tg["api_url"] = f"http://host.docker.internal:{STUB_PORT}"
            tg.pop("bot_token_file", None)
            tg.pop("chat_id_file", None)
            tg["bot_token"] = "0:preview"
            tg["chat_id"] = 1
        for wh in receiver.get("webhook_configs", []):
            wh.pop("url_file", None)
            wh["url"] = f"http://host.docker.internal:{STUB_PORT}/webhook"

    # 묶음이 열리기를 기다리는 시간만 줄인다. 검사 대상은 문구와 group_by 이고
    # 그 둘은 이 값에 영향받지 않는다. 운영값(10s)대로 두면 매번 10초를 센다.
    cfg["route"]["group_wait"] = "1s"
    return cfg


def container_env() -> list[str]:
    """values 의 extraEnv 를 그대로 넘긴다. 시각이 KST 로 찍히는 것이 거기서 나온다 —
    빼먹으면 미리보기만 UTC 로 나와 운영과 다른 문구를 보게 된다."""
    values = yaml.safe_load(AM_VALUES.read_text(encoding="utf-8"))
    out: list[str] = []
    for item in values["alertmanager"].get("extraEnv", []):
        out += ["-e", f"{item['name']}={item['value']}"]
    return out


class Stub(http.server.BaseHTTPRequestHandler):
    captured: list[str] = []

    def do_POST(self):  # noqa: N802
        body = self.rfile.read(int(self.headers.get("content-length", 0)))
        if "sendMessage" in self.path:
            try:
                Stub.captured.append(json.loads(body)["text"])
            except (ValueError, KeyError):
                Stub.captured.append(body.decode("utf-8", "replace"))
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        # 응답을 대충 돌려주면 Alertmanager 의 텔레그램 발신부가 nil 역참조로 죽는다
        # (telegram.go:124). 첫 통만 나가고 죽어서, 처음에는 통 수가 실행마다 다른
        # 것처럼 보였다. 진짜 API 가 주는 모양대로 chat 까지 채워서 돌려준다.
        self.wfile.write(json.dumps({
            "ok": True,
            "result": {"message_id": len(Stub.captured), "date": 0,
                       "chat": {"id": 1, "type": "private"}, "text": ""},
        }).encode())

    def log_message(self, *_args):
        pass


def wait_until(check, timeout: float, what: str) -> None:
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        if check():
            return
        time.sleep(0.2)
    raise SystemExit(f"시간 초과: {what}")


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    rules = load_rules()

    if "--list" in sys.argv:
        for name in sorted(rules):
            mark = " " if name in SERIES_LABELS else " (샘플 라벨 없음)"
            print(f"{name}{mark}")
        return 0

    wanted = args or [n for n in SERIES_LABELS if n in rules]
    missing = [n for n in wanted if n not in rules]
    if missing:
        # 규칙이 사라졌는데 예시만 살아남으면 이 스크립트가 거짓말을 한다.
        print(f"규칙 파일에 없는 alertname: {', '.join(missing)}", file=sys.stderr)
        return 1

    results: list[tuple[str, str | None]] = []
    WORK.mkdir(exist_ok=True)
    (WORK / "alertmanager.yml").write_text(yaml.safe_dump(build_config(), allow_unicode=True), encoding="utf-8")

    server = http.server.ThreadingHTTPServer(("0.0.0.0", STUB_PORT), Stub)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    subprocess.run(["docker", "rm", "-f", "alert-preview"], capture_output=True, check=False)
    # 앞선 컨테이너가 포트를 놓기 전에 새로 띄우면, 준비 판정이 죽어 가는 옛 쪽을
    # 맞히고 통과한다. 그 뒤 알림을 보내면 connection reset 이 난다.
    if not wait_for(lambda: not probe(f"http://localhost:{AM_PORT}/-/healthy"), 15):
        return print(f"{AM_PORT} 포트를 쓰는 무언가가 남아 있다", file=sys.stderr) or 1
    subprocess.run(
        ["docker", "run", "-d", "--rm", "--name", "alert-preview",
         "-p", f"{AM_PORT}:9093", "-v", f"{WORK}/alertmanager.yml:/etc/alertmanager/alertmanager.yml",
         *container_env(), "--add-host", "host.docker.internal:host-gateway", IMAGE,
         "--config.file=/etc/alertmanager/alertmanager.yml"],
        check=True, capture_output=True,
    )
    try:
        wait_until(lambda: probe(f"http://localhost:{AM_PORT}/-/healthy"), 30, "Alertmanager 기동")

        # 한 건씩 보내고 그 건이 도착할 때까지 기다린다. 한꺼번에 던지면 묶음이
        # 흩어지는 시점이 실행마다 달라 매번 다른 부분집합이 잡힌다 — 실제로 9통과
        # 6통이 번갈아 나왔다. 미리보기가 실행마다 달라지면 볼 이유가 없다.
        for name in wanted:
            rule = rules[name]
            labels = {"alertname": name, **rule.get("labels", {}), **SERIES_LABELS.get(name, {})}
            annotations = {k: render_annotation(v, labels) for k, v in rule.get("annotations", {}).items()}
            before = len(Stub.captured)
            post(f"http://localhost:{AM_PORT}/api/v2/alerts", [{"labels": labels, "annotations": annotations}])
            arrived = wait_for(lambda: len(Stub.captured) > before, 15)
            results.append((name, Stub.captured[-1] if arrived else None))
    finally:
        subprocess.run(["docker", "rm", "-f", "alert-preview"], capture_output=True, check=False)
        server.shutdown()

    for i, (name, text) in enumerate(results, 1):
        print(f"\n{'=' * 68}\n[{i}/{len(results)}] {name}\n{'=' * 68}")
        print(text if text else "(도착하지 않았다 — 라우팅이나 억제 규칙을 본다)")
    silent = [n for n, t in results if t is None]
    print(f"\n{len(results) - len(silent)}통 도착. 폰으로는 아무것도 가지 않았다.")
    if silent:
        print(f"안 온 규칙: {', '.join(silent)}")
    return 0


def wait_for(check, timeout: float) -> bool:
    """도착하면 True, 시간이 다 되면 False. 안 온 것도 결과라 여기서 죽이지 않는다."""
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        if check():
            return True
        time.sleep(0.2)
    return False


def probe(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1):
            return True
    except (urllib.error.URLError, OSError):
        return False


def post(url: str, body: list) -> None:
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"content-type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read()


if __name__ == "__main__":
    raise SystemExit(main())
