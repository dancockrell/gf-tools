#!/bin/bash
# =========================================================================
# SHIP TO ITCH. Usage: tools/push.sh <version-number> [file]
#
# Packages the game as an HTML5 build (index.html in its own folder --
# itch requires the entry file to be named index.html) and pushes it to
# dancockrell/ghost-front:html with the version stamped on the build.
#
# Credentials: butler reads ~/.config/itch/butler_creds. That file is
# staged from Downloads\gf-tools\butler_creds by the session and is never
# printed. If it is missing, this script says so and exits 2.
# =========================================================================
set -e
V="${1:?usage: push.sh <version> [file]}"
SRC="${2:-/root/gf/v4.html}"
TARGET="dancockrell/ghost-front:html"
CRED="$HOME/.config/itch/butler_creds"
if [ ! -s "$CRED" ]; then
  echo "NO CREDENTIALS at $CRED -- stage Downloads/gf-tools/butler_creds first." >&2
  exit 2
fi
chmod 600 "$CRED"
rm -rf /tmp/gf_dist && mkdir -p /tmp/gf_dist
cp "$SRC" /tmp/gf_dist/index.html
/root/gf/tools/butler push /tmp/gf_dist "$TARGET" --userversion "$V" --if-changed
/root/gf/tools/butler status "$TARGET" | tail -5
