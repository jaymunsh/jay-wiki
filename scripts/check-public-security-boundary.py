#!/usr/bin/env python3
"""Unauthenticated, bounded checks of this project's public HTTP boundary.

Run from a GitHub-hosted runner for an off-LAN vantage point. This checks HTTP
routes and the SSH Access gateway, not direct origin ports or Tailscale ACLs.
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    opener = urllib.request.build_opener(NoRedirect)
    failed = False
    checks = [(f"https://{host}{path}", method, "closed-route")
              for host in ("portfolio.leneu.cloud", "blog.leneu.cloud")
              for path, method in (("/sync", "GET"), ("/api/sync", "POST"),
                                   ("/actuator/env", "GET"), ("/internal/content-sync/blog-posts", "GET"))]
    checks.append(("https://ssh.leneu.cloud", "GET", "access-gateway"))
    for url, method, kind in checks:
        request = urllib.request.Request(url, data=b"{}" if method == "POST" else None,
                                         method=method, headers={"Content-Type": "application/json"})
        try:
            try:
                response = opener.open(request, timeout=15)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                status = response.code
                location = urllib.parse.urlparse(response.headers.get("Location", ""))
                allowed = status in (403, 404) if kind == "closed-route" else (
                    status == 403 or (status in (302, 303) and (location.hostname or "").endswith(".cloudflareaccess.com")))
            print(json.dumps({"url": url, "method": method, "status": status, "passed": allowed}))
            failed |= not allowed
        except (OSError, urllib.error.URLError):
            print(json.dumps({"url": url, "method": method, "passed": False, "error": "connection-failed"}))
            failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
