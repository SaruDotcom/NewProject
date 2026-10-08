const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/database');
const ensureSuperAdmin = require('./services/ensureSuperAdmin');

// Server entry point for B2B Wholesale Platform Backend
let server;

const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Ensure Default Super Admin Exists
    await ensureSuperAdmin();

    // 3. Start HTTP Server
    server = app.listen(env.PORT, () => {
      logger.info(`====================================================`);
      logger.info(`🚀 B2B Wholesale Platform Backend Running`);
      logger.info(`🌐 Environment: ${env.NODE_ENV}`);
      logger.info(`📡 Port: ${env.PORT}`);
      logger.info(`🔗 API Base: http://localhost:${env.PORT}/api/v1`);
      logger.info(`❤️  Health Check: http://localhost:${env.PORT}/health`);
      logger.info(`====================================================`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful Shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(`Unhandled Rejection: ${reason && reason.stack ? reason.stack : reason}`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  logger.error(`Uncaught Exception thrown: ${error.stack || error.message}`);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
