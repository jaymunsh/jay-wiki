#!/bin/zsh
set -eu

SOURCE_DIR=${0:A:h}
INSTALL_DIR=${FIXNET_INSTALL_DIR:-"$HOME/.local/lib/fixnet"}
BIN_DIR=${FIXNET_BIN_DIR:-"$HOME/.local/bin"}

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

for file in fixnet.zsh netrecord.py; do
  temporary="$INSTALL_DIR/.$file.$$"
  cp "$SOURCE_DIR/$file" "$temporary"
  chmod 755 "$temporary"
  mv -f "$temporary" "$INSTALL_DIR/$file"
done

ln -sfn "$INSTALL_DIR/fixnet.zsh" "$BIN_DIR/fixnet"
ln -sfn "$INSTALL_DIR/netrecord.py" "$BIN_DIR/netrecord"

"$BIN_DIR/fixnet" --check
echo "설치 완료: $INSTALL_DIR"
