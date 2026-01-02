import { connectDB, disconnectDB } from "./config/db";
import { env, validateEnv } from "./config/env";
import createApp from "./app";
import { logger } from "./shared/utils/logger";

// Validate environment variables
validateEnv();

const app = createApp();
const PORT = env.PORT;

/**
 * Start the HTTP server and connect to MongoDB.
 */
async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🔗 API base URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received. Shutting down gracefully...`);

  try {
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Start the server
void startServer();

