module.exports = {
  apps: [
    {
      name: 'mafia-server',
      cwd: './server',
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
        PORT: 3001,
        JWT_SECRET: 'change-me-in-production',
        ADMIN_USERNAMES: 'admin',
      },
    },
  ],
};
