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

export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { status } = userReq.query;
    const { clerkUserId } = userReq.user;

    const items = await itemService.getItems(
      clerkUserId,
      status as string | undefined
    );

    ApiResponse.success(res, items);
  } catch (error: any) {
    logger.error("Error in getItems controller:", error);
    ApiResponse.error(res, "Failed to fetch items", 500);
  }
};

export const getItemById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { id } = userReq.params;
    const { clerkUserId } = userReq.user;

    const item = await itemService.getItemById(id, clerkUserId);

    if (!item) {
      ApiResponse.error(res, "Item not found", 404);
      return;
    }

    ApiResponse.success(res, item);
  } catch (error: any) {
    logger.error("Error in getItemById controller:", error);
    ApiResponse.error(res, "Failed to fetch item", 500);
  }
};

export const getTodaysItems = async (
  req: UserRequest,
  res: Response
): Promise<void> => {};

export const deleteItem = async (
  req: UserRequest,
  res: Response
): Promise<void> => {};
