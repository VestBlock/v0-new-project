#!/bin/zsh

set -euo pipefail

ROOT="${VESTBLOCK_ROOT:-/Users/mrsanders/VestBlock Codex Sync/Codex Folder}"
LABEL="io.vestblock.on-market-creative-daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$ROOT/logs"
SEND_MODE="${ON_MARKET_CREATIVE_SEND:-0}"

if [[ ! -x "$ROOT/scripts/run-on-market-creative-daily.sh" ]]; then
  echo "VestBlock runner is not executable at $ROOT/scripts/run-on-market-creative-daily.sh" >&2
  echo "Set VESTBLOCK_ROOT to the repository path on the primary Mac and retry." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

/usr/bin/python3 - "$PLIST" "$LABEL" "$ROOT" "$LOG_DIR" "$SEND_MODE" <<'PY'
import plistlib
import sys

plist_path, label, root, log_dir, send_mode = sys.argv[1:]
payload = {
    "Label": label,
    "ProgramArguments": [f"{root}/scripts/run-on-market-creative-daily.sh"],
    "WorkingDirectory": root,
    "EnvironmentVariables": {
        "VESTBLOCK_ROOT": root,
        "ON_MARKET_CREATIVE_SEND": send_mode,
    },
    "StartCalendarInterval": {"Hour": 9, "Minute": 15},
    "RunAtLoad": False,
    "StandardOutPath": f"{log_dir}/on-market-creative-daily.launchd.out.log",
    "StandardErrorPath": f"{log_dir}/on-market-creative-daily.launchd.err.log",
}
with open(plist_path, "wb") as output:
    plistlib.dump(payload, output)
PY

plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed $LABEL"
echo "Repository: $ROOT"
echo "Mode: $([[ "$SEND_MODE" == "1" ]] && echo live-send || echo ingest-and-review-queue-no-direct-send)"
echo "Schedule: daily at 09:15 local time"
echo "Log: $LOG_DIR/on-market-creative-daily.log"
