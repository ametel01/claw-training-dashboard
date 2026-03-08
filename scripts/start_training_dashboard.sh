#!/bin/zsh
set -euo pipefail

WORKDIR="/Users/brunoclaw/source/training-dasboard"
PYTHON_BIN="/opt/homebrew/bin/python3"
export PORT="${PORT:-8080}"

cd "$WORKDIR"
exec "$PYTHON_BIN" dashboard/server.py
