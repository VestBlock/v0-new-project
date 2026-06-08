#!/bin/zsh
# Installs a macOS LaunchAgent that runs the distress-stack daily at 7:05 AM,
# advancing each market's area queue (gradual daily expansion).
#
#   zsh scripts/install-distress-stack-agent.sh           # install + load
#   launchctl unload ~/Library/LaunchAgents/io.vestblock.distress-stack.plist   # to stop

set -euo pipefail
PROJECT_DIR="${VESTBLOCK_DIR:-/Users/mrsanders/Downloads/Codex Folder}"
LABEL="io.vestblock.distress-stack"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_BIN="$(command -v node || echo /usr/local/bin/node)"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$PROJECT_DIR/scripts/distress-stack-daily.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>VESTBLOCK_DIR</key><string>$PROJECT_DIR</string>
    <key>PATH</key><string>$(dirname "$NODE_BIN"):/usr/bin:/bin:/usr/local/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>5</integer></dict>
  <key>StandardOutPath</key><string>$PROJECT_DIR/data/distress-leads/logs/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$PROJECT_DIR/data/distress-leads/logs/launchd.err.log</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed + loaded LaunchAgent: $LABEL (runs daily 7:05 AM)"
echo "Plist: $PLIST"
echo "To run once now:  zsh $PROJECT_DIR/scripts/distress-stack-daily.sh"
echo "To stop:          launchctl unload $PLIST"
