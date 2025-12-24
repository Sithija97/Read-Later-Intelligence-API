import { Request, Response, NextFunction } from "express";
import { getClerkClient, verifyToken } from "../config/clerk";
import { AuthRequest } from "../shared/types/express";
import { ApiResponse } from "../shared/utils/apiResponse";
import { logger } from "../shared/utils/logger";
import { ERROR_MESSAGES } from "../shared/constants/errors";

/**
 * Verifies Clerk JWT token and extracts identityUser (clerkUserId, email, name).
 * Adds req.auth with IdentityUser.
 * Does NOT require ProductUser to exist in database.
 *
 * Used for: /auth/sync-user route
 */
export async function requireClerkAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ApiResponse.error(res, ERROR_MESSAGES.AUTH_HEADER_MISSING, 401);
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token with Clerk and get userId from payload
    const verifyResult = await verifyToken(token);
    const userId = (verifyResult as any).sub || (verifyResult as any).userId;

    if (!userId) {
      ApiResponse.error(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
      return;
    }

    // Get user details from Clerk
    const clerk = getClerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    if (!clerkUser) {
      ApiResponse.error(res, ERROR_MESSAGES.AUTH_FAILED, 401);
      return;
    }

    // Extract email - prioritize primary email
    const primaryEmail = clerkUser.emailAddresses.find(
      (email: any) => email.id === clerkUser.primaryEmailAddressId
    );
    const email = primaryEmail?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      ApiResponse.error(res, ERROR_MESSAGES.AUTH_FAILED, 401);
      return;
    }

    // Extract name from first name and last name
    const firstName = clerkUser.firstName || "";
    const lastName = clerkUser.lastName || "";
    const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;

    // Attach auth data to request
    (req as AuthRequest).auth = {
      clerkUserId: userId,
      email,
      name,
    };

    next();
  } catch (error) {
    logger.error("Clerk auth error:", error);
    ApiResponse.error(res, ERROR_MESSAGES.AUTH_FAILED, 401);
  }
}

