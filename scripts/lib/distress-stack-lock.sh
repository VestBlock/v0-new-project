#!/bin/zsh

# PID- and age-aware lock helpers for the daily Stack runner. The caller owns
# the trap so the lock covers the complete multi-process shell workflow.

vestblock_stack_lock_mtime() {
  local lock_dir="$1"
  /usr/bin/stat -f %m "$lock_dir" 2>/dev/null || /usr/bin/stat -c %Y "$lock_dir" 2>/dev/null || echo 0
}

vestblock_stack_lock_digits() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  tr -cd '0-9' < "$file"
}

vestblock_stack_lock_active() {
  local lock_dir="$1"
  local max_age_seconds="$2"
  local now existing_pid started_at age
  now="$(date +%s)"
  existing_pid="$(vestblock_stack_lock_digits "$lock_dir/pid")"
  started_at="$(vestblock_stack_lock_digits "$lock_dir/started_at")"
  if [[ -z "$started_at" ]]; then
    started_at="$(vestblock_stack_lock_mtime "$lock_dir")"
  fi
  age=$(( now - ${started_at:-0} ))

  # A just-created directory without its owner file is in the acquisition
  # grace window; do not let another process reclaim it mid-write.
  if [[ -z "$existing_pid" && "$age" -ge 0 && "$age" -lt 60 ]]; then
    return 0
  fi
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null && [[ "$age" -ge 0 && "$age" -lt "$max_age_seconds" ]]; then
    return 0
  fi
  return 1
}

vestblock_acquire_stack_lock() {
  local lock_dir="$1"
  local max_age_seconds="$2"
  local log_file="$3"
  mkdir -p "$(dirname "$lock_dir")"

  if ! mkdir "$lock_dir" 2>/dev/null; then
    if vestblock_stack_lock_active "$lock_dir" "$max_age_seconds"; then
      echo "===== distress-stack daily run already active $(date) =====" >> "$log_file"
      return 1
    fi
    echo "===== reclaiming stale distress-stack lock $(date) =====" >> "$log_file"
    rm -f "$lock_dir/pid" "$lock_dir/started_at"
    if ! rmdir "$lock_dir" 2>/dev/null || ! mkdir "$lock_dir" 2>/dev/null; then
      echo "===== distress-stack lock changed during stale recovery $(date) =====" >> "$log_file"
      return 1
    fi
  fi

  printf '%s\n' "$$" > "$lock_dir/pid"
  date +%s > "$lock_dir/started_at"
  VESTBLOCK_STACK_LOCK_DIR="$lock_dir"
  VESTBLOCK_STACK_LOCK_PID="$$"
  return 0
}

vestblock_release_stack_lock() {
  local lock_dir="${VESTBLOCK_STACK_LOCK_DIR:-}"
  local owner_pid
  [[ -n "$lock_dir" && -d "$lock_dir" ]] || return 0
  owner_pid="$(vestblock_stack_lock_digits "$lock_dir/pid")"
  [[ "$owner_pid" == "${VESTBLOCK_STACK_LOCK_PID:-$$}" ]] || return 0
  rm -f "$lock_dir/pid" "$lock_dir/started_at"
  rmdir "$lock_dir" 2>/dev/null || true
}
