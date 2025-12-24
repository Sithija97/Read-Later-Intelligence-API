import { createClerkClient, verifyToken as clerkVerifyToken } from "@clerk/backend";
import { env } from "./env";

/**
 * Get Clerk secret key from environment variables
 */
function getClerkSecretKey(): string {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY is not defined. Set CLERK_SECRET_KEY in your environment."
    );
  }

  return env.CLERK_SECRET_KEY;
}

/**
 * Initialize and export Clerk client
 * The createClerkClient function uses CLERK_SECRET_KEY from environment
 */
export function getClerkClient() {
  // Verify that CLERK_SECRET_KEY is set (will throw if not)
  const secretKey = getClerkSecretKey();
  
  // Return clerkClient instance with secret key
  return createClerkClient({ secretKey });
}

/**
 * Verify Clerk JWT token
 */
export async function verifyToken(token: string) {
  const secretKey = getClerkSecretKey();
  return await clerkVerifyToken(token, { secretKey });
}

