import { Response } from "express";

/**
 * Standard API response utility
 */
export class ApiResponse {
  static success(res: Response, data: any, message?: string, statusCode = 200): void {
    res.status(statusCode).json({
      status: "success",
      message,
      data,
    });
  }

  static error(res: Response, message: string, statusCode = 500, errors?: any): void {
    res.status(statusCode).json({
      status: "error",
      message,
      ...(errors && { errors }),
    });
  }

  static created(res: Response, data: any, message?: string): void {
    this.success(res, data, message, 201);
  }
}

