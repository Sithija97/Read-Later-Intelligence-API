import mongoose from "mongoose";

/**
 * Get MongoDB connection string from environment.
 * Supports both `MONGO_URI` and `DATABASE_URL` for flexibility.
 */
function getMongoUri(): string {
  const uri = process.env.MONGO_URI || process.env.DATABASE_URL;

  if (!uri) {
    throw new Error(
      "MongoDB connection string is not defined. Set MONGO_URI or DATABASE_URL in your environment."
    );
  }

  return uri;
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

    console.log(`✅ MongoDB connected: ${connection.connection.host}`);

    return connection;
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
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
      console.log("✅ MongoDB connection closed");
    }
  } catch (error) {
    console.error("❌ Error while closing MongoDB connection:", error);
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
    console.log(
      `✅ MongoDB connection test succeeded: ${connection.connection.host}`
    );
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}
