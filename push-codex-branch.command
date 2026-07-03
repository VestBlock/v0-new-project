#!/bin/zsh
# Run this on the MacBook AIR (Codex's machine) — double-click in Finder.
# It pushes Codex's local revenue-command-center branch to GitHub so its work
# can be reviewed and merged into main instead of living only on one laptop.
#
# If Codex's clone is in a different folder on the Air, drag this file into
# that folder first, then double-click it there.

cd "$(dirname "$0")" || exit 1
echo "Pushing Codex branch from: $(pwd)"

git push origin codex/revenue-command-center-finish || {
  echo ""
  echo "Branch not found here. Codex's clone may be elsewhere (e.g. ~/Downloads/Codex Folder)."
  echo "Move this file into that folder and double-click it there."
}

echo ""
echo "Done. Tell Claude so it can merge the branch into main."
