#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
BUN_BIN="${BUN_BIN:-$(command -v bun || true)}"
if [[ -z "${BUN_BIN}" ]]; then
  BUN_BIN="/opt/homebrew/bin/bun"
fi
export BUN_BIN
export PORT="${PORT:-8080}"

cd "$WORKDIR"
exec "$PYTHON_BIN" dashboard/server.py
