import { Request, Response, NextFunction } from "express";
import { getClerkClient, verifyToken } from "../config/clerk";
import { UserRequest } from "../shared/types/express";
import { ClerkJwtPayload } from "../shared/types/clerk";
import { userRepository } from "../modules/users/user.repository";
import { ApiResponse } from "../shared/utils/apiResponse";
import { logger } from "../shared/utils/logger";
import { ERROR_MESSAGES } from "../shared/constants/errors";

/**
 * Verifies Clerk JWT token and ensures ProductUser exists in database.
 * Adds req.user with the full ProductUser document + identity info (email, name) from Clerk.
 * Rejects if ProductUser not found.
 *
 * Used for: Articles, Summaries, Tags, Preferences routes
 */
export async function attachUser(
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
    const verifyResult = (await verifyToken(token)) as ClerkJwtPayload;
    const userId = verifyResult.sub || verifyResult.userId;

    if (!userId) {
      ApiResponse.error(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
      return;
    }

    // Fetch ProductUser from database
    const productUser = await userRepository.findByClerkId(userId);

    if (!productUser) {
      ApiResponse.error(res, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      return;
    }

    // Get identity info from Clerk (email, name)
    const clerk = getClerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    if (!clerkUser) {
      ApiResponse.error(res, ERROR_MESSAGES.AUTH_FAILED, 401);
      return;
    }

    // Extract email - prioritize primary email
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );
    const email = primaryEmail?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    // Extract name from first name and last name
    const firstName = clerkUser.firstName || "";
    const lastName = clerkUser.lastName || "";
    const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;

    // Attach user with identity info to request
    (req as UserRequest).user = {
      ...productUser.toObject(),
      email,
      name,
    } as UserRequest["user"];

    next();
  } catch (error) {
    logger.error("Auth error:", error);
    ApiResponse.error(res, ERROR_MESSAGES.AUTH_FAILED, 401);
  }
}

