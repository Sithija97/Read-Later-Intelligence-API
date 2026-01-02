import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../shared/utils/logger";

/**
 * Get MongoDB connection string from environment.
 */
function getMongoUri(): string {
  if (!env.MONGO_URI) {
    throw new Error(
      "MongoDB connection string is not defined. Set MONGO_URI or DATABASE_URL in your environment."
    );
  }

  return env.MONGO_URI;
}

/**
 * Connect to MongoDB using Mongoose.
 * This is intended to be called once on application startup.
 */
export async function connectDB(): Promise<typeof mongoose> {
  try {
    mongoose.set("strictQuery", true);

    const uri = getMongoUri();
    const connection = await mongoose.connect(uri);

    logger.info(`✅ MongoDB connected: ${connection.connection.host}`);

    return connection;
  } catch (error) {
    logger.error("❌ Failed to connect to MongoDB:", error);
    throw error;
  }
}

/**
 * Gracefully close the MongoDB connection.
 * Call this during application shutdown.
 */
export async function disconnectDB(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info("✅ MongoDB connection closed");
    }
  } catch (error) {
    logger.error("❌ Error while closing MongoDB connection:", error);
  }
}

/**
 * Simple helper to test that a connection can be established.
 * Does not keep the connection open.
 */
export async function testConnection(): Promise<void> {
  const uri = getMongoUri();

  try {
    mongoose.set("strictQuery", true);
    const connection = await mongoose.connect(uri);
    logger.info(
      `✅ MongoDB connection test succeeded: ${connection.connection.host}`
    );
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}
