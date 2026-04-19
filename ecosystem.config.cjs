const appName = process.env.PM2_APP_NAME ?? "gp-wanghao";
const port = process.env.PORT ?? "3000";
const host = process.env.HOSTNAME ?? "0.0.0.0";

module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start --hostname ${host} --port ${port}`,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: port,
        HOSTNAME: host
      }
    }
  ]
};
