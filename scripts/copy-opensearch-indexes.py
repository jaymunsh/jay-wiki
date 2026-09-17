#!/usr/bin/env python3
"""Copy the two app indexes into an explicitly inactive TLS destination.

Resets only the two named destination indexes. Use while app writers are paused
for final cutover. Source indexes are read only. Credentials never enter argv.
"""
import argparse
import json
import http.client
import urllib.parse
from pathlib import Path
import ssl


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--target-inactive", action="store_true", required=True)
    parser.add_argument("--checkpoint", type=Path, help="Reuse only if both source and target shard histories are unchanged")
    args = parser.parse_args()
    if not args.target.startswith("https://") or args.target == args.source:
        parser.error("A different, TLS destination is required")
    tls = ssl.create_default_context(cafile=str(args.bundle / "tls/ca.pem"))
    tls.load_cert_chain(str(args.bundle / "tls/admin.pem"), str(args.bundle / "tls/admin-key.pem"))

    connections = {}
    for base in (args.source, args.target):
        parsed = urllib.parse.urlparse(base)
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            parser.error("Use a plain endpoint URL; credentials must remain in files")
        connections[base] = (http.client.HTTPSConnection(parsed.hostname, parsed.port, context=tls, timeout=30)
                             if base == args.target else http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=30))

    def request(base, path, method="GET", body=None, ndjson=False, missing=False):
        data = body.encode() if ndjson else json.dumps(body).encode() if body is not None else None
        connection = connections[base]
        connection.request(method, path, body=data,
                           headers={"Content-Type": "application/x-ndjson" if ndjson else "application/json"})
        response = connection.getresponse()
        payload = response.read()
        if missing and response.status == 404:
            return None
        if response.status // 100 != 2:
            raise RuntimeError(f"Index copy HTTP {response.status}; response body suppressed")
        return json.loads(payload)

    checkpoints = json.loads(args.checkpoint.read_text()) if args.checkpoint and args.checkpoint.exists() else {}

    def history(base, index):
        stats = request(base, "/" + index + "/_stats?level=shards", missing=True)
        if stats is None:
            return None
        item = stats["indices"][index]
        return {"uuid": item["uuid"], "primary": {
            shard: [entry["seq_no"] for entry in entries if entry["routing"]["primary"]]
            for shard, entries in item["shards"].items()}}

    for index in ("jaywiki-posts-v1", "jaywiki-articles-v1"):
        before = history(args.source, index)
        previous = checkpoints.get(index)
        if (previous and previous["source"] == before
                and previous["target"] == history(args.target, index)):
            print(json.dumps({"index": index, "action": "unchanged source and target shard histories; reused"}), flush=True)
            continue
        definition = request(args.source, "/" + index, missing=True)
        if definition is None:
            print(json.dumps({"index": index, "source": "absent", "action": "skipped"}), flush=True)
            continue
        original = definition[index]
        settings = {key: value for key, value in original["settings"]["index"].items()
                    if key in ("analysis", "number_of_shards", "refresh_interval", "max_ngram_diff", "similarity")}
        settings["number_of_replicas"] = 0
        request(args.target, "/" + index, "DELETE", missing=True)
        request(args.target, "/" + index, "PUT", {"settings": settings, "mappings": original["mappings"]})
        page = request(args.source, "/" + index + "/_search?scroll=2m", "POST", {"size": 5000, "sort": ["_doc"], "query": {"match_all": {}}, "track_total_hits": True})
        expected = page["hits"]["total"]["value"]
        copied = 0
        scroll = page.get("_scroll_id")
        try:
            while page["hits"]["hits"]:
                lines = []
                for hit in page["hits"]["hits"]:
                    lines.extend((json.dumps({"index": {"_id": hit["_id"]}}), json.dumps(hit["_source"])))
                result = request(args.target, "/" + index + "/_bulk", "POST", "\n".join(lines) + "\n", ndjson=True)
                if result.get("errors"):
                    raise RuntimeError("Bulk copy rejected documents; destination is not ready for cutover")
                copied += len(page["hits"]["hits"])
                page = request(args.source, "/_search/scroll", "POST", {"scroll": "2m", "scroll_id": scroll})
                scroll = page.get("_scroll_id", scroll)
            request(args.target, "/" + index + "/_refresh", "POST")
            count = request(args.target, "/" + index + "/_count")["count"]
            if count != copied or copied != expected:
                raise RuntimeError("Index count mismatch; destination is not ready for cutover")
            if history(args.source, index) != before:
                raise RuntimeError("Source changed during copy; pause writers and repeat before cutover")
            checkpoints[index] = {"source": before, "target": history(args.target, index)}
            if args.checkpoint:
                temporary = args.checkpoint.with_suffix(".partial")
                temporary.write_text(json.dumps(checkpoints, indent=2))
                temporary.replace(args.checkpoint)
            print(json.dumps({"index": index, "sourceSnapshot": expected, "copied": copied, "targetCount": count}), flush=True)
        finally:
            if scroll:
                request(args.source, "/_search/scroll", "DELETE", {"scroll_id": [scroll]})


if __name__ == "__main__":
    main()
