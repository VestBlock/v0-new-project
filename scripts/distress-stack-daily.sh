#!/bin/zsh
# VestBlock — daily distress-stack runner.
# Processes the next areas in each market's queue and appends to a dated lead file.
# Wired for launchd (see install-distress-stack-agent.sh) or cron.

set -euo pipefail
PROJECT_DIR="${VESTBLOCK_DIR:-/Users/mrsanders/VestBlockProduction}"
cd "$PROJECT_DIR"
/usr/bin/env node scripts/require-primary-machine.mjs

LOG_DIR="$PROJECT_DIR/data/distress-leads/logs"
LOCK_DIR="${STACK_LOCK_DIR:-$PROJECT_DIR/tmp/locks/distress-stack-daily.lock}"
LOCK_MAX_AGE_SECONDS="${STACK_LOCK_MAX_AGE_SECONDS:-21600}"
mkdir -p "$LOG_DIR"
source "$PROJECT_DIR/scripts/lib/distress-stack-lock.sh"
if ! vestblock_acquire_stack_lock "$LOCK_DIR" "$LOCK_MAX_AGE_SECONDS" "$LOG_DIR/launchd.out.log"; then
  exit 0
fi
trap 'vestblock_release_stack_lock' EXIT
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

# Rank and submit the best unique multi-signal properties into the production
# property-intelligence queue. Contact lookup remains a separate enrichment
# action and never inflates this property-sourcing count.
/usr/bin/env node --env-file=.env.local scripts/push-distress-stack-daily.mjs \
  --date="$STAMP" \
  --limit="${STACK_DAILY_LIMIT:-500}" \
  --apply >> "$LOG" 2>&1
echo "done $(date)" >> "$LOG"
