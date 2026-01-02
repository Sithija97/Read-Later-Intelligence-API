/**
 * Clerk JWT token payload
 */
export interface ClerkJwtPayload {
  sub?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Mongoose duplicate key error
 */
export interface MongooseDuplicateKeyError extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

