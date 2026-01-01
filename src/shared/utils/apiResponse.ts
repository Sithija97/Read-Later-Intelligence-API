import { Response } from "express";

/**
 * Standard API response utility
 */
export class ApiResponse {
  static success<T = unknown>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200
  ): void {
    res.status(statusCode).json({
      status: "success",
      message,
      data,
    });
  }

  static error(
    res: Response,
    message: string,
    statusCode = 500,
    errors?: unknown
  ): void {
    res.status(statusCode).json({
      status: "error",
      message,
      ...(typeof errors === "object" && errors !== null ? { errors } : {}),
    });
  }

  static created<T = unknown>(res: Response, data: T, message?: string): void {
    this.success(res, data, message, 201);
  }
}
