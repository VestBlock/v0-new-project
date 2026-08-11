#!/bin/sh
set -eu

PAPERCLIP_SOURCE='/Users/mrsanders/VestBlockOps/paperclip'
PAPERCLIP_STATE='/Users/mrsanders/VestBlockOps/state'

export PATH='/Users/mrsanders/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
export PAPERCLIP_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1
export PORT=3212

cd "$PAPERCLIP_SOURCE"
exec corepack pnpm@9.15.4 paperclipai run \
  --data-dir "$PAPERCLIP_STATE" \
  --instance vestblock \
  --bind loopback
