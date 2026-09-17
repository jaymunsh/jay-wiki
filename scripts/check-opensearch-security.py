#!/usr/bin/env python3
"""Verify TLS, authentication, allowed app operations, and denied admin/index access.

Writes then deletes one uniquely named probe document in the app index. Run only
against the explicitly selected server. Never logs authentication headers.
"""
import argparse
import base64
import json
from pathlib import Path
import ssl
import urllib.error
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--url", required=True)
    args = parser.parse_args()
    if not args.url.startswith("https://"):
        parser.error("HTTPS required")
    ctx = ssl.create_default_context(cafile=str(args.bundle / "tls/ca.pem"))
    auth = "Basic " + base64.b64encode(((args.bundle / "username").read_text() + ":" + (args.bundle / "password").read_text()).encode()).decode()

    def request(method, path, body=None, authenticated=True):
        headers = {"Content-Type": "application/json"}
        if authenticated:
            headers["Authorization"] = auth
        req = urllib.request.Request(args.url + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    def check(label, actual, expected):
        print(json.dumps({"check": label, "status": actual, "passed": actual in expected}))
        if actual not in expected:
            raise RuntimeError("OpenSearch security check failed: " + label)

    check("unauthenticated", request("GET", "/", authenticated=False), {401})
    index = "/jaywiki-posts-v1"
    exists = request("HEAD", index)
    if exists == 404:
        check("create allowed index", request("PUT", index, {"settings": {"number_of_replicas": 0}}), {200})
    else:
        check("allowed index exists", exists, {200})
    document = index + "/_doc/security-probe-" + uuid.uuid4().hex
    try:
        check("write allowed document", request("PUT", document, {"body": "isolated security verification"}), {201})
        check("refresh allowed index", request("POST", index + "/_refresh"), {200})
        check("search allowed index", request("POST", index + "/_search", {"size": 0, "query": {"match_all": {}}}), {200})
        check("deny unrelated index", request("PUT", "/security-forbidden-probe", {}), {403})
        check("deny security administration", request("GET", "/_plugins/_security/api/internalusers"), {403})
    finally:
        check("delete probe", request("DELETE", document), {200, 404})
        check("refresh after cleanup", request("POST", index + "/_refresh"), {200})


if __name__ == "__main__":
    main()
