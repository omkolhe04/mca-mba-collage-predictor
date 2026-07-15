'use strict';

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(env.port, () => {
  logger.info(`${env.appName} running`, { port: env.port, env: env.nodeEnv });
});

// Graceful shutdown for cPanel/Passenger restarts and VPS process managers
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
});
