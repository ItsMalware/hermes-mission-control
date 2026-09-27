#!/usr/bin/env bash
# Restore the custom Hermes Mission Control desktop UI after a `hermes update`
# rebuilds/bundle-swaps the upstream Nous app over it.
#
# It rebuilds the app from THIS repo (hermes-desktop) and reinstalls it to
# /Applications, then relaunches. Your source is the source of truth; the
# installed app is disposable.
#
# Usage:  bash scripts/restore-ui.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$REPO_ROOT/apps/desktop"
APP_NAME="Hermes Mission Control.app"
SRC_APP="$DESKTOP_DIR/release/mac-arm64/$APP_NAME"
DST_APP="/Applications/$APP_NAME"

echo "==> Rebuilding the custom Hermes desktop app from $REPO_ROOT"
( cd "$DESKTOP_DIR" && npm run pack )

if [ ! -d "$SRC_APP" ]; then
  echo "!! Build did not produce $SRC_APP — aborting so the installed app is left intact." >&2
  exit 1
fi

echo "==> Quitting the running app (if any)"
osascript -e 'quit app "Hermes Mission Control"' 2>/dev/null || true
sleep 2
pkill -f "/Applications/Hermes Mission Control.app/Contents/MacOS/" 2>/dev/null || true
sleep 2

echo "==> Installing the freshly built app to /Applications"
rm -rf "$DST_APP"
cp -R "$SRC_APP" "$DST_APP"

VER="$(defaults read "$DST_APP/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo '?')"
ID="$(defaults read "$DST_APP/Contents/Info.plist" CFBundleIdentifier 2>/dev/null || echo '?')"
echo "==> Installed v$VER ($ID)"

echo "==> Relaunching"
open -a "$DST_APP"
echo "==> Done. If the UI still looks like upstream Nous, quit and reopen once more."
