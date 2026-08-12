#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${VESTBLOCK_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOG_DIR="$ROOT/logs"
LOCK_DIR="$ROOT/tmp/locks/on-market-creative-daily.lock"

mkdir -p "$LOG_DIR" "$(dirname "$LOCK_DIR")"

timestamp() {
  date "+%Y-%m-%dT%H:%M:%S%z"
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(timestamp)] on-market creative daily run already active; skipping." >> "$LOG_DIR/on-market-creative-daily.log"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export ON_MARKET_CREATIVE_PRICE_MIN="${ON_MARKET_CREATIVE_PRICE_MIN:-50000}"
export ON_MARKET_CREATIVE_PRICE_MAX="${ON_MARKET_CREATIVE_PRICE_MAX:-1000000}"
export ON_MARKET_CREATIVE_LIMIT="${ON_MARKET_CREATIVE_LIMIT:-100}"
export ON_MARKET_CREATIVE_HARVEST_LIMIT="${ON_MARKET_CREATIVE_HARVEST_LIMIT:-140}"
export ON_MARKET_CREATIVE_MIN_DOM="${ON_MARKET_CREATIVE_MIN_DOM:-45}"

{
  echo "[$(timestamp)] Starting on-market creative daily city lane"
  if [[ "${ON_MARKET_CREATIVE_SEND:-0}" == "1" ]]; then
    node scripts/require-primary-machine.mjs
    npm run sellers:on-market-creative:daily:send
  else
    npm run sellers:on-market-creative:daily
  fi
  echo "[$(timestamp)] Finished on-market creative daily city lane"
} >> "$LOG_DIR/on-market-creative-daily.log" 2>&1
