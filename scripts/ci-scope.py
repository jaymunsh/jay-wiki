#!/usr/bin/env python3
"""Select PR checks from the complete merge-base diff; non-PR events run everything."""
import json
import os
import subprocess

COMPONENTS = ("web", "spring", "payment-api", "shipping-api", "partner-simulator")


def scope(paths, full=False):
    selected = set(COMPONENTS) if full else set()
    for path in paths:
        if path.startswith(("docs/", "posts/")) or (path.startswith("content/") and path.endswith(".md")) or (
            "/" not in path and path.endswith(".md")
        ):
            continue
        component = next((c for c in COMPONENTS if path.startswith(
            (c + "/") if c in ("web", "spring") else ("services/" + c + "/")
        )), None)
        if component:
            selected.add(component)
        else:
            # Workflow, infra, shared scripts and unknown paths can affect every component.
            selected.update(COMPONENTS)
    return {
        "spring": "spring" in selected,
        # Editorial E2E starts Spring, so backend changes must also exercise the web.
        "web": bool(selected & {"web", "spring"}),
        "node": "web" in selected,
        "payment": "payment-api" in selected,
        "shipping": "shipping-api" in selected,
        "images": [c if c in ("web", "spring") else "services/" + c
                   for c in COMPONENTS if c in selected],
        "python": [c for c in COMPONENTS if c.endswith("-api") or c == "partner-simulator"
                   if c in selected],
    }


def changed_paths(base, head):
    # No rename detection: moving code out of a component must still select its old path.
    raw = subprocess.check_output(
        ["git", "diff", "--name-only", "--no-renames", "-z", base + "..." + head]
    )
    return raw.decode("utf-8").rstrip("\0").split("\0") if raw else []


def main():
    event = os.environ.get("GITHUB_EVENT_NAME")
    if event == "pull_request":
        result = scope(changed_paths(os.environ["PR_BASE_SHA"], os.environ["PR_HEAD_SHA"]))
    else:
        result = scope([], full=True)
    lines = "\n".join(k + "=" + json.dumps(v, separators=(",", ":")) for k, v in result.items())
    print(lines)
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(lines + "\n")


if __name__ == "__main__":
    main()
