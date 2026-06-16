#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

load_env() {
  local env_file="$ROOT/server/.env"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    echo "==> loaded server/.env"
  else
    echo "WARN: server/.env not found — copy server/.env.example and set JWT_SECRET"
  fi
}

require_jwt_secret() {
  local secret="${JWT_SECRET:-}"
  if [[ -z "$secret" ]]; then
    echo "ERROR: JWT_SECRET is empty in server/.env"
    echo "  cp server/.env.example server/.env && nano server/.env"
    exit 1
  fi
  if [[ ${#secret} -lt 32 ]]; then
    echo "ERROR: JWT_SECRET is too short (${#secret} chars, need at least 32)"
    echo "  Generate: openssl rand -base64 48"
    echo "  Then paste into server/.env: JWT_SECRET=..."
    exit 1
  fi
  case "$secret" in
    change-me-in-production|mafia-dev-secret-change-in-production)
      echo "ERROR: JWT_SECRET must not use the default placeholder value"
      exit 1
      ;;
  esac
}

load_env
export NODE_ENV="${NODE_ENV:-production}"
require_jwt_secret

echo "==> git pull"
git pull --ff-only

echo "==> build client"
cd "$ROOT/client"
npm install
npm run build

echo "==> build server"
cd "$ROOT/server"
npm install
npm run build

if [[ ! -f "$ROOT/server/dist/server.js" ]]; then
  echo "ERROR: server/dist/server.js not found after build"
  exit 1
fi

echo "==> verify database schema"
node "$ROOT/scripts/verify-db.mjs"

echo "==> npm audit (high) — informational"
npm audit --audit-level=high || true
cd "$ROOT/client"
npm audit --audit-level=high || true

echo "==> pm2 restart"
cd "$ROOT"
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
