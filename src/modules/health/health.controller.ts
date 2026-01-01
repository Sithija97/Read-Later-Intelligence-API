import { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/apiResponse";
import { env } from "../../config/env";

/**
 * Health check endpoint handler
 * GET /api/v1/health
 */
export const checkHealth = async (_req: Request, res: Response): Promise<void> => {
  ApiResponse.success(res, {
    message: "Health check passed. API is running smoothly.",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    service: "Read-Later-Intelligence-API",
  });
};
