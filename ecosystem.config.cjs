module.exports = {
  apps: [
    {
      name: 'mafia-server',
      cwd: './server',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        JWT_SECRET: 'change-me-in-production',
        ADMIN_USERNAMES: 'admin',
      },
    },
  ],
};
