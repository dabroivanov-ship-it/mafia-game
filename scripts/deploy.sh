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

echo "==> pm2 restart"
cd "$ROOT"
if pm2 describe mafia-server >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save

sleep 1
echo "==> health check"
HEALTH="$(curl -sf http://127.0.0.1:3001/api/health || true)"
if [[ -z "$HEALTH" ]]; then
  echo "ERROR: /api/health did not respond"
  pm2 logs mafia-server --lines 30 --nostream
  exit 1
fi

echo "==> done"
echo "$HEALTH" | head -c 300
echo
