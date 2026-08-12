#!/bin/zsh
set -euo pipefail

ROOT="${VESTBLOCK_ROOT:-/Users/mrsanders/VestBlockOps}"
LABEL="io.vestblock.public-distress-daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$ROOT/logs"

if [[ ! -x "$ROOT/scripts/run-public-distress-daily.sh" ]]; then
  echo "VestBlock runner is not executable at $ROOT/scripts/run-public-distress-daily.sh" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
/usr/bin/python3 - "$PLIST" "$LABEL" "$ROOT" "$LOG_DIR" <<'PY'
import plistlib
import sys

plist_path, label, root, log_dir = sys.argv[1:]
payload = {
    "Label": label,
    "ProgramArguments": [f"{root}/scripts/run-public-distress-daily.sh"],
    "WorkingDirectory": root,
    "EnvironmentVariables": {"VESTBLOCK_ROOT": root},
    "StartCalendarInterval": {"Hour": 8, "Minute": 30},
    "RunAtLoad": False,
    "StandardOutPath": f"{log_dir}/public-distress-daily.launchd.out.log",
    "StandardErrorPath": f"{log_dir}/public-distress-daily.launchd.err.log",
}
with open(plist_path, "wb") as output:
    plistlib.dump(payload, output)
PY

plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed $LABEL"
echo "Repository: $ROOT"
echo "Mode: public-record-ingest-and-evidence-stacking-no-direct-outreach"
echo "Schedule: daily at 08:30 local time"
echo "Log: $LOG_DIR/public-distress-daily.log"
