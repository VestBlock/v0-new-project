#!/bin/zsh

set -euo pipefail

ROOT="${VESTBLOCK_ROOT:-/Users/mrsanders/VestBlock Codex Sync/Codex Folder}"
NODE_BIN="${NODE_BIN:-/usr/local/bin/node}"
LABEL="io.vestblock.dealmachine-export-watcher"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$ROOT/logs"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>--env-file=.env.local</string>
    <string>scripts/dealmachine-local-export-watcher.mjs</string>
    <string>--apply</string>
    <string>--since-days=30</string>
    <string>--max-files=30</string>
    <string>--dirs=$ROOT/data/dm-exports/incoming</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT</string>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/dealmachine-export-watcher.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/dealmachine-export-watcher.error.log</string>
</dict>
</plist>
PLIST

plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed $LABEL"
echo "Plist: $PLIST"
echo "Log: $LOG_DIR/dealmachine-export-watcher.log"
