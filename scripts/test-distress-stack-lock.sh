#!/bin/zsh

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_DIR/scripts/lib/distress-stack-lock.sh"

TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
LOG_FILE="$TEST_DIR/lock.log"
LOCK_DIR="$TEST_DIR/distress-stack.lock"

mkdir "$LOCK_DIR"
vestblock_stack_lock_active "$LOCK_DIR" 300
rmdir "$LOCK_DIR"

mkdir "$LOCK_DIR"
printf '%s\n' '99999999' > "$LOCK_DIR/pid"
printf '%s\n' "$(( $(date +%s) - 600 ))" > "$LOCK_DIR/started_at"
vestblock_acquire_stack_lock "$LOCK_DIR" 300 "$LOG_FILE"
[[ "$(<"$LOCK_DIR/pid")" == "$$" ]]
vestblock_release_stack_lock
[[ ! -d "$LOCK_DIR" ]]

sleep 30 &
ACTIVE_PID=$!
mkdir "$LOCK_DIR"
printf '%s\n' "$ACTIVE_PID" > "$LOCK_DIR/pid"
date +%s > "$LOCK_DIR/started_at"
if vestblock_acquire_stack_lock "$LOCK_DIR" 300 "$LOG_FILE"; then
  echo 'active lock was incorrectly reclaimed' >&2
  kill "$ACTIVE_PID" 2>/dev/null || true
  exit 1
fi
kill "$ACTIVE_PID" 2>/dev/null || true
wait "$ACTIVE_PID" 2>/dev/null || true
rm -f "$LOCK_DIR/pid" "$LOCK_DIR/started_at"
rmdir "$LOCK_DIR"

echo 'distress Stack lock tests passed'
