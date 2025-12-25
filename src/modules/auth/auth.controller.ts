import { Request, Response } from "express";
import { AuthRequest } from "../../shared/types/express";
import { MongooseDuplicateKeyError } from "../../shared/types/clerk";
import { authService } from "./auth.service";
import { ApiResponse } from "../../shared/utils/apiResponse";
import { logger } from "../../shared/utils/logger";
import { ERROR_MESSAGES } from "../../shared/constants/errors";

/**
 * Authentication controller
 */
export class AuthController {
  /**
   * Sync user endpoint handler
   * POST /api/v1/auth/sync-user
   * Creates or updates ProductUser in database based on Clerk authentication
   */
  async syncUser(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { clerkUserId } = authReq.auth;
      const identityUser = authReq.auth; // Contains clerkUserId, email, name

      // Find or create ProductUser
      const { productUser, isNew } = await authService.syncProductUser(
        clerkUserId
      );

      const responseData = {
        productUser: {
          id: productUser._id,
          clerkUserId: productUser.clerkUserId,
          createdAt: productUser.createdAt,
          updatedAt: productUser.updatedAt,
        },
        identityUser: {
          clerkUserId: identityUser.clerkUserId,
          email: identityUser.email,
          name: identityUser.name,
        },
      };

      if (isNew) {
        ApiResponse.created(
          res,
          responseData,
          "ProductUser created successfully"
        );
      } else {
        ApiResponse.success(res, responseData, "ProductUser already exists");
      }
    } catch (error) {
      logger.error("Sync user error:", error);

      // Handle duplicate key error
      const mongooseError = error as MongooseDuplicateKeyError;
      if (mongooseError.code === 11000) {
        ApiResponse.error(res, ERROR_MESSAGES.USER_ALREADY_EXISTS, 409);
        return;
      }

      ApiResponse.error(res, ERROR_MESSAGES.USER_SYNC_FAILED, 500);
    }
  }
}

// Export singleton instance
export const authController = new AuthController();
