const path = require('path');

const serverDir = path.join(__dirname, 'server');
const serverEntry = path.join(serverDir, 'dist', 'server.js');

module.exports = {
  apps: [
    {
      name: 'mafia-server',
      cwd: serverDir,
      script: serverEntry,
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
        DB_PATH: process.env.DB_PATH,
        UPLOADS_DIR: process.env.UPLOADS_DIR,
        CORS_ORIGIN: process.env.CORS_ORIGIN,
      },
    },
  ],
};
