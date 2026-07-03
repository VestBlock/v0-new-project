#!/bin/zsh
# VestBlock — send today's approved reactivation batch (LIVE).
# Double-click in Finder. Rob approved this batch on 2026-07-03: 50-email cap,
# verified reactivation queue, CAN-SPAM footer, suppression/reply recheck at send time.

cd "$(dirname "$0")" || exit 1
echo "══════════════════════════════════════════════════"
echo " VestBlock LIVE SEND — reactivation batch (cap 50)"
echo "══════════════════════════════════════════════════"

node --env-file=.env.local scripts/send-reactivation-batch.mjs --live --limit=50 \
  --csv="data/operating-loops/reactivation/reactivation-queue-2026-07-02T17-45-53-243Z-verified.csv"

echo ""
echo "Done. Replies will be auto-attributed by reply-sync / the morning brief."
echo "Tell Claude the result so it can confirm ledger + lane stats."
