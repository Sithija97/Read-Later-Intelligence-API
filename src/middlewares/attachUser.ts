import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../config/clerk";
import { UserRequest } from "../shared/types/express";
import { userRepository } from "../modules/users/user.repository";
import { ApiResponse } from "../shared/utils/apiResponse";
import { logger } from "../shared/utils/logger";
import { ERROR_MESSAGES } from "../shared/constants/errors";

/**
 * Verifies Clerk JWT token and ensures ProductUser exists in database.
 * Adds req.user with the full ProductUser document.
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
    const verifyResult = await verifyToken(token);
    const userId = (verifyResult as any).sub || (verifyResult as any).userId;

    if (!userId) {
      ApiResponse.error(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
      return;
    }

    // Fetch ProductUser from database
    const user = await userRepository.findByClerkId(userId);

    if (!user) {
      ApiResponse.error(res, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      return;
    }

    // Attach user to request
    (req as UserRequest).user = user;

    next();
  } catch (error) {
    logger.error("Auth error:", error);
    ApiResponse.error(res, ERROR_MESSAGES.AUTH_FAILED, 401);
  }
}

