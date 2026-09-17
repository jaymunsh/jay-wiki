#!/usr/bin/env bash
# Root preparation only. Does not stop or move an active runner.
set -euo pipefail
[[ $(id -u) == 0 ]] || exit 1
account=jaywiki-runner
home=/opt/jaywiki-runner
if ! id "$account" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$home" --shell /usr/sbin/nologin "$account"
fi
[[ "$(id -nG "$account")" == "$account" ]] || { echo 'Runner has unexpected supplementary groups'; exit 1; }
chmod 0700 "$home"
install -d -m 0700 -o "$account" -g "$account" "$home/.kube"
source=/home/jaymunsh/actions-runner/jay-wiki
[[ -f "$source/.runner" && -f "$source/.credentials" ]] || { echo 'Registered source runner missing'; exit 1; }
install -d -m 0700 -o "$account" -g "$account" "$home/runner"
rsync -a --exclude=_work --exclude=_diag "$source/" "$home/runner/"
# Runner self-updates leave absolute bin/externals symlinks in the old home.
/usr/bin/python3 - "$source" "$home/runner" <<'PYTHON'
import os,sys
from pathlib import Path
source,target=map(Path,sys.argv[1:])
for directory, dirs, files in os.walk(target, followlinks=False):
    for name in dirs+files:
        link=Path(directory)/name
        if link.is_symlink():
            value=Path(os.readlink(link))
            if value.is_absolute() and value.is_relative_to(source):
                relative=value.relative_to(source)
                link.unlink()
                link.symlink_to(target/relative)
PYTHON
chown -R "$account:$account" "$home"
echo 'Separate locked OS account prepared; original runner still active.'
