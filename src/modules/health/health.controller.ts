import { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/apiResponse";
import { env } from "../../config/env";
import { UserRequest } from "../../shared/types/express";

/**
 * Health check controller
 */
export class HealthController {
  /**
   * Health check endpoint handler
   * GET /api/v1/health
   */
  async checkHealth(_req: Request, res: Response): Promise<void> {
    const userReq = _req as UserRequest;
    console.log(userReq.user);
    ApiResponse.success(res, {
      message: "Health check passed. API is running smoothly.",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      service: "Read-Later-Intelligence-API",
    });
  }
}

// Export singleton instance
export const healthController = new HealthController();
