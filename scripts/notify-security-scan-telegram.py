#!/usr/bin/env python3
"""정기 Security 검사 결과를 텔레그램으로 보낸다.

공개 저장소 workflow 에는 비밀값을 두지 않는다. 그래서 검사는 공개 쪽(GitHub-hosted)에서 돌고,
이 스크립트는 비공개 ops 의 miniPC 러너가 1시간 뒤에 돌려 결과를 읽어 보낸다. 봇 자격증명은
배포 알림과 같은 클러스터 Secret(obs/alertmanager-telegram)이다.

    python3 scripts/notify-security-scan-telegram.py            # 보낸다
    python3 scripts/notify-security-scan-telegram.py --dry-run  # 문구만 찍는다

검사가 실패해도, 알림을 못 보내도 exit 0 이다. 이 스크립트가 할 일은 알리는 것뿐이다.
"""
import base64
import html
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = "jaymunsh/jay-wiki"
API = f"https://api.github.com/repos/{REPO}/actions"
KST = timezone(timedelta(hours=9))
# 검사는 이틀마다 돈다. 그보다 조금 넘게 비면 「안 돌았다」로 본다.
STALE = timedelta(hours=50)
WARN_DAYS = 7
ROOT = Path(__file__).resolve().parent.parent


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "jay-wiki-security-notify"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)


def expiries():
    """예외 만료일. npm 정책과 OpenVEX 두 곳에 따로 적혀 있다."""
    out = []
    vex = json.loads((ROOT / "security/jaywiki.openvex.json").read_text())
    if when := vex.get("x-jaywiki-review-before"):
        out.append(("Spring·이미지 예외(VEX)", when))
    npm = (ROOT / "scripts/lib/npm-audit-policy.mjs").read_text()
    if m := re.search(r"EXPIRES\s*=\s*Date\.parse\('([^']+)'\)", npm):
        out.append(("npm 예외", m.group(1)))
    return [(name, datetime.fromisoformat(when.replace("Z", "+00:00"))) for name, when in out]


def message(now):
    runs = get(f"{API}/workflows/security.yml/runs?event=schedule&branch=main&per_page=1")["workflow_runs"]
    run = runs[0] if runs else None
    started = datetime.fromisoformat(run["created_at"].replace("Z", "+00:00")) if run else None

    soonest = min(expiries(), key=lambda x: x[1], default=None)
    days_left = (soonest[1] - now).days if soonest else None
    warn = days_left is not None and days_left <= WARN_DAYS
    if soonest:
        days = f"<b>{days_left}일</b>" if warn else f"{days_left}일"
        expiry_line = f"예외 만료까지 {days} ({soonest[1].astimezone(KST):%m/%d})"
    else:
        expiry_line = "예외 없음"

    if run is None or now - started > STALE:
        last = f"마지막 실행 {started.astimezone(KST):%m/%d %H:%M}" if started else "실행 기록 없음"
        return f"🟡 <b>보안 검사가 돌지 않았습니다</b>\n{last}\n{expiry_line}\n\n할 일: Actions 의 Security 예약 실행이 꺼졌는지 확인\n🔗 <a href=\"https://github.com/{REPO}/actions/workflows/security.yml\">Security workflow</a>"

    link = f"🔗 <a href=\"{run['html_url']}\">실행 기록</a>"
    if run["status"] != "completed":
        return f"🟡 <b>보안 검사가 아직 끝나지 않았습니다</b>\n{started.astimezone(KST):%H:%M} 시작\n{expiry_line}\n{link}"

    jobs = get(f"{API}/runs/{run['id']}/jobs?per_page=100")["jobs"]
    failed = [j["name"] for j in jobs if j["conclusion"] in ("failure", "timed_out", "cancelled")]
    if failed:
        lines = "\n".join(f" • {html.escape(name)}" for name in failed)
        return (f"🔴 <b>보안 검사 실패 · {len(failed)}개 단계</b>\n{lines}\n{expiry_line}\n\n"
                f"할 일: 새 취약점이면 버전 올리기, 고칠 버전이 없으면 앱에 해당하는지 판단해 예외 등록\n{link}")

    passed = sum(1 for j in jobs if j["conclusion"] == "success")
    if warn:
        return (f"🟡 <b>보안 예외 만료 {days_left}일 전</b>\n검사는 통과({passed}개 단계)\n{expiry_line} · {soonest[0]}\n\n"
                f"할 일: 만료 전에 예외를 다시 확인하고 기한 연장 또는 패치\n{link}")
    return f"🛡 <b>보안 검사 이상 없음</b>\n{passed}개 단계 통과\n{expiry_line}\n{link}"


def secret(key):
    raw = subprocess.run(
        ["kubectl", "-n", "obs", "get", "secret/alertmanager-telegram", "-o", f"jsonpath={{.data.{key}}}"],
        capture_output=True, text=True, check=False).stdout
    return base64.b64decode(raw).decode() if raw else ""


def main():
    try:
        text = message(datetime.now(timezone.utc))
    except Exception as e:  # GitHub API 가 흔들려도 알린다. 조용히 끝나면 41일짜리 침묵이 된다.
        text = f"🟡 <b>보안 검사 결과를 읽지 못했습니다</b>\n{html.escape(str(e))[:300]}"
    if "--dry-run" in sys.argv:
        print(text)
        return
    token, chat = secret("bot-token"), secret("chat-id")
    if not token or not chat:
        print("::warning::telegram secret obs/alertmanager-telegram is missing; skipping")
        return
    print(f"::add-mask::{token}")
    body = urllib.parse.urlencode({"chat_id": chat, "parse_mode": "HTML", "disable_web_page_preview": "true", "text": text}).encode()
    try:
        urllib.request.urlopen(f"https://api.telegram.org/bot{token}/sendMessage", data=body, timeout=15)
    except Exception:
        print("::warning::telegram security notification failed to send")


if __name__ == "__main__":
    main()
