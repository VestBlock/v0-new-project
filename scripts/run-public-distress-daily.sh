#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${VESTBLOCK_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOG_DIR="$ROOT/logs"
LOCK_DIR="$ROOT/tmp/locks/public-distress-daily.lock"

mkdir -p "$LOG_DIR" "$(dirname "$LOCK_DIR")"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] public distress daily run already active; skipping." >> "$LOG_DIR/public-distress-daily.log"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

cd "$ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

{
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Starting public distress daily city lane"
  node --env-file=.env.local scripts/public-distress-daily-city.mjs
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Finished public distress daily city lane"
} >> "$LOG_DIR/public-distress-daily.log" 2>&1
