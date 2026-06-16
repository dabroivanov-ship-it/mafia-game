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

if [[ ! -f "$ROOT/server/dist/server.js" ]]; then
  echo "ERROR: server/dist/server.js not found after build"
  exit 1
fi

echo "==> pm2 restart"
cd "$ROOT"

# Recreate process so PM2 picks up script path (stale dumps may still point at server.js)
pm2 delete mafia-server 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env
pm2 save

echo "==> health check"
HEALTH=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  HEALTH="$(curl -sf http://127.0.0.1:3001/api/health || true)"
  if [[ -n "$HEALTH" ]]; then
    break
  fi
  sleep 1
done
if [[ -z "$HEALTH" ]]; then
  echo "ERROR: /api/health did not respond"
  pm2 logs mafia-server --lines 30 --nostream
  exit 1
fi

echo "==> done"
echo "$HEALTH" | head -c 300
echo
