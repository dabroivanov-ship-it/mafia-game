const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const serverDir = path.join(rootDir, 'server');
const envPath = path.join(serverDir, '.env');

function loadServerEnv() {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
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
    if (!process.env[key]) process.env[key] = val;
  }
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
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_USERNAMES: process.env.ADMIN_USERNAMES || 'admin',
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_WEBAPP_URL: process.env.TELEGRAM_WEBAPP_URL,
        DB_PATH: process.env.DB_PATH,
        UPLOADS_DIR: process.env.UPLOADS_DIR,
      },
    },
  ],
};
