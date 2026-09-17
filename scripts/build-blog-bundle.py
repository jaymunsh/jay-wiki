#!/usr/bin/env python3
"""Create a bounded bundle containing only explicitly selected regular drafts."""
import argparse
import io
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--draft-dir', type=Path, default=ROOT / 'posts/jay-blog/drafts')
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--manifest', type=Path)
    selection.add_argument('--all', action='store_true', help='Size inspection only')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    names = sorted(p.name for p in args.draft_dir.glob('*.md')) if args.all else [
        line.strip() for line in args.manifest.read_text().splitlines()
        if line.strip() and not line.lstrip().startswith('#')]
    if len(names) != len(set(names)):
        parser.error('Duplicate draft selection')
    if not names:
        print('No drafts selected; nothing will be published')
        return
    entries = []
    total = 0
    for name in names:
        path = args.draft_dir / name
        if not re.fullmatch(r'[a-zA-Z0-9_-]+\.md', name) or path.is_symlink() or not path.is_file():
            parser.error(f'Invalid draft selection: {name}')
        total += path.stat().st_size
        if total > 32 * 1024 * 1024:
            parser.error('Drafts exceed 32 MiB uncompressed limit')
        entries.append(('drafts/' + name, path.read_bytes()))
    entries.append(('publish-blog-drafts.mjs', (ROOT / 'scripts/publish-blog-drafts.mjs').read_bytes()))
    if sum(len(data) for _, data in entries) > 32 * 1024 * 1024:
        parser.error('Bundle exceeds 32 MiB uncompressed limit')
    with tarfile.open(args.output, 'w:gz') as archive:
        for name, data in entries:
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(data), 0o600
            archive.addfile(info, io.BytesIO(data))
    size = args.output.stat().st_size
    if size > 16 * 1024 * 1024:
        args.output.unlink()
        parser.error('Bundle exceeds 16 MiB compressed limit')
    print(f'Selected {len(names)} drafts: {total} bytes -> {size} bytes')


if __name__ == '__main__':
    main()
