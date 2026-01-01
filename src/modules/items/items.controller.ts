import { Request, Response } from "express";
import { UserRequest } from "../../shared/types/express";
import { ApiResponse } from "../../shared/utils/apiResponse";
import { itemService } from "./item.service";
import { logger } from "../../shared/utils/logger";

export const createItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { url } = userReq.body;

    const result = await itemService.createItem({
      url,
      clerkUserId: userReq.user.clerkUserId,
    });

    ApiResponse.created(res, result, "Item created successfully");
  } catch (error: any) {
    logger.error("Error in createItem controller:", error);

    // Map service errors to appropriate HTTP status codes
    if (
      error.message?.includes("required") ||
      error.message?.includes("Invalid URL") ||
      error.message?.includes("protocol")
    ) {
      ApiResponse.error(res, error.message, 400);
      return;
    }

    if (error.message?.includes("already exists")) {
      ApiResponse.error(res, error.message, 409);
      return;
    }

    ApiResponse.error(res, "Failed to create item", 500);
  }
};

export const getItems = async (
  req: UserRequest,
  res: Response
): Promise<void> => {};

export const getItemById = async (
  req: UserRequest,
  res: Response
): Promise<void> => {};

export const getTodaysItems = async (
  req: UserRequest,
  res: Response
): Promise<void> => {};

export const deleteItem = async (
  req: UserRequest,
  res: Response
): Promise<void> => {};
