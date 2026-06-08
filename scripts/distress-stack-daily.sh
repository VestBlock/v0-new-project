#!/bin/zsh
# VestBlock — daily distress-stack runner.
# Processes the next areas in each market's queue and appends to a dated lead file.
# Wired for launchd (see install-distress-stack-agent.sh) or cron.

set -euo pipefail
PROJECT_DIR="${VESTBLOCK_DIR:-/Users/mrsanders/Downloads/Codex Folder}"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/data/distress-leads/logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y-%m-%d)"
LOG="$LOG_DIR/run-$STAMP.log"

# Markets to advance each day (add more as they are wired into MARKETS in the builder).
# cincinnati = tax-delinquent × code-violation (neighborhood queue, 2 areas/day)
# milwaukee  = tax-delinquent × vacant building (whole-city each run)
MARKETS=("cincinnati" "milwaukee" "toledo" "detroit")
AREAS_PER_RUN="${AREAS_PER_RUN:-2}"

echo "===== distress-stack daily run $(date) =====" >> "$LOG"
for m in "${MARKETS[@]}"; do
  echo "--- market: $m ---" >> "$LOG"
  /usr/bin/env node scripts/distress-stack-builder.mjs --market="$m" --areas="$AREAS_PER_RUN" >> "$LOG" 2>&1 || echo "  (market $m failed)" >> "$LOG"
done
echo "done $(date)" >> "$LOG"
