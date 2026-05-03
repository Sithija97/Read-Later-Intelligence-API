import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

/**
 * Environment variable configuration
 */
export const env = {
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // MongoDB
  MONGO_URI: process.env.MONGO_URI || process.env.DATABASE_URL,

  // Clerk
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

  // Redis (used by BullMQ job queue)
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // OpenAI (optional — used for AI-powered summarization)
  // If not set, the scraper falls back to extractive summarization.
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): void {
  const required = [
    { key: "MONGO_URI", value: env.MONGO_URI },
    { key: "CLERK_SECRET_KEY", value: env.CLERK_SECRET_KEY },
  ];

  const missing = required.filter((item) => !item.value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map((m) => m.key).join(", ")}`,
    );
  }
}
