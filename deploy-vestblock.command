#!/bin/zsh
# VestBlock one-click deploy — double-click this file in Finder.
# Chain: typecheck+build gate -> operating-loops tests -> push main -> production deploy.
# Stops at the first failure so nothing half-ships. Safe to rerun.

cd "$(dirname "$0")" || exit 1
echo "══════════════════════════════════════════════════"
echo " VestBlock deploy — $(pwd)"
echo "══════════════════════════════════════════════════"

set -e
npm run check:app
npm run test:operating-loops
git push origin main
npm run deploy:web:prod

echo ""
echo "✓ Deploy complete. Tell Claude so it can verify the live site."
