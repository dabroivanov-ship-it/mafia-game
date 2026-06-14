#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull

echo "==> build client"
cd client
npm install
npm run build

echo "==> build server"
cd ../server
npm install
npm run build

if [[ ! -f dist/server.js ]]; then
  echo "ERROR: server/dist/server.js not found after build"
  exit 1
fi

echo "==> smoke test (5s)"
timeout 5 node dist/server.js &
PID=$!
sleep 2
if ! curl -sf http://127.0.0.1:3001/api/health >/dev/null; then
  kill "$PID" 2>/dev/null || true
  echo "ERROR: server did not respond on /api/health"
  exit 1
fi
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

echo "==> pm2 restart"
cd "$ROOT"
pm2 start ecosystem.config.cjs --update-env
pm2 save

echo "==> done"
curl -s http://127.0.0.1:3001/api/health | head -c 200
echo
