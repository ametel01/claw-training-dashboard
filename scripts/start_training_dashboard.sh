#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUN_BIN="${BUN_BIN:-$(command -v bun || true)}"
if [[ -z "${BUN_BIN}" ]]; then
  BUN_BIN="/opt/homebrew/bin/bun"
fi
export BUN_BIN
NODE_BIN="${NODE_BIN:-node}"
export PORT="${PORT:-8080}"

cd "$WORKDIR"
SERVER_ENTRY="$WORKDIR/server/dist/server/src/index.js"
if [[ ! -f "$SERVER_ENTRY" ]]; then
  "$BUN_BIN" run build:server >/dev/null
fi

exec env NODE_NO_WARNINGS=1 "$NODE_BIN" "$SERVER_ENTRY"
