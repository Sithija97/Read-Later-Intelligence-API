import { Request, Response, NextFunction } from "express";
import { MongooseDuplicateKeyError } from "../shared/types/clerk";
import { ApiResponse } from "../shared/utils/apiResponse";
import { logger } from "../shared/utils/logger";
import { ERROR_MESSAGES } from "../shared/constants/errors";

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error("Error:", err);

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    ApiResponse.error(res, ERROR_MESSAGES.VALIDATION_ERROR, 400, err);
    return;
  }

  // Handle duplicate key errors
  const mongooseError = err as MongooseDuplicateKeyError;
  if (mongooseError.code === 11000) {
    ApiResponse.error(res, ERROR_MESSAGES.USER_ALREADY_EXISTS, 409);
    return;
  }

  // Default error response
  ApiResponse.error(res, ERROR_MESSAGES.INTERNAL_SERVER_ERROR, 500);
}

