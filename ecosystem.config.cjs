const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const serverDir = path.join(rootDir, 'server');
const envPath = path.join(serverDir, '.env');

function isUnsetEnv(value) {
  if (value == null) return true;
  const trimmed = String(value).trim();
  return !trimmed || trimmed === 'undefined';
}

function loadServerEnv() {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function pickEnv(keys) {
  const out = {};
  for (const key of keys) {
    if (!isUnsetEnv(process.env[key])) out[key] = process.env[key];
  }
  return out;
}

loadServerEnv();

module.exports = {
  apps: [
    {
      name: 'mafia-server',
      cwd: serverDir,
      script: 'dist/server.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3001',
        TRUST_PROXY: process.env.TRUST_PROXY || '1',
        ADMIN_USERNAMES: process.env.ADMIN_USERNAMES || 'admin',
        ...pickEnv([
          'JWT_SECRET',
          'CORS_ORIGIN',
          'SITE_URL',
          'TELEGRAM_BOT_TOKEN',
          'TELEGRAM_WEBAPP_URL',
          'TELEGRAM_OIDC_CLIENT_ID',
          'TELEGRAM_OIDC_CLIENT_SECRET',
          'TELEGRAM_OIDC_REDIRECT_URI',
          'VK_CLIENT_ID',
          'VK_CLIENT_SECRET',
          'VK_REDIRECT_URI',
          'DB_PATH',
          'UPLOADS_DIR',
        ]),
      },
    },
  ],
};
