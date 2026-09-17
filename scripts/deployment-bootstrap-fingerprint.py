#!/usr/bin/env python3
"""Digest operator-owned inputs; application deployments do not approve this value."""
import hashlib
from pathlib import Path
paths = [Path('infra/k8s/00-namespaces.yaml'), Path('infra/k8s/backend/jaywiki-control-rbac.yaml'), Path('infra/k8s/backend/rehearsal-isolation.yaml')]
for directory in ('infra/k8s/delivery', 'infra/k8s/observability', 'infra/k8s/data', 'infra/k8s/backup'):
    paths.extend(p for p in Path(directory).rglob('*') if p.is_file())
digest = hashlib.sha256()
for path in sorted(set(paths)):
    digest.update(str(path).encode() + b'\0' + path.read_bytes() + b'\0')
print(digest.hexdigest())
