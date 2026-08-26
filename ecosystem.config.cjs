/**
 * ==============================================================================
 * PACHAS - PM2 PRODUCTION CLUSTER CONFIGURATION (NATIVE NODE.JS)
 * ==============================================================================
 * Run with: npx pm2 start ecosystem.config.cjs
 * Status:   npx pm2 status
 * Logs:     npx pm2 logs pachas-prod
 * Stop:     npx pm2 stop ecosystem.config.cjs
 * ==============================================================================
 */

module.exports = {
  apps: [
    {
      name: 'pachas-prod',
      script: './deploy/start-node-prod.mjs',
      instances: 'max', // Multi-instance cluster utilizing all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
