/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  // Authentication
  AUTH_HEADER_MISSING: "Authorization header missing or invalid",
  INVALID_TOKEN: "Invalid or expired token",
  USER_NOT_FOUND: "User not found. Please sync your account first.",
  AUTH_FAILED: "Authentication failed",

  // User
  USER_ALREADY_EXISTS: "User already exists",
  USER_SYNC_FAILED: "Failed to sync user",

  // General
  INTERNAL_SERVER_ERROR: "Internal server error",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation error",
} as const;

