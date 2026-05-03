import { Request, Response } from "express";
import { UserRequest } from "../../shared/types/express";
import { ApiResponse } from "../../shared/utils/apiResponse";
import { itemService } from "./item.service";
import { logger } from "../../shared/utils/logger";

export const createItem = async (
  req: Request,
  res: Response,
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
      status as string | undefined,
    );

    ApiResponse.success(res, items);
  } catch (error: any) {
    logger.error("Error in getItems controller:", error);
    ApiResponse.error(res, "Failed to fetch items", 500);
  }
};

export const getItemById = async (
  req: Request,
  res: Response,
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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const items = await itemService.getTodaysItems(userReq.user.clerkUserId);
    ApiResponse.success(res, items);
  } catch (error: any) {
    logger.error("Error in getTodaysItems controller:", error);
    ApiResponse.error(res, "Failed to fetch today's items", 500);
  }
};

export const completeItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { id } = userReq.params;
    const { isCompleted, isSkimmed } = userReq.body;

    if (typeof isCompleted !== "boolean" && typeof isSkimmed !== "boolean") {
      ApiResponse.error(
        res,
        "isCompleted or isSkimmed (boolean) is required",
        400,
      );
      return;
    }

    const result = await itemService.completeItem(
      id,
      userReq.user.clerkUserId,
      Boolean(isCompleted),
      Boolean(isSkimmed),
    );

    if (!result) {
      ApiResponse.error(res, "Item not found", 404);
      return;
    }

    ApiResponse.success(res, result, "Item updated successfully");
  } catch (error: any) {
    logger.error("Error in completeItem controller:", error);
    ApiResponse.error(res, "Failed to update item", 500);
  }
};

export const submitFeedback = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { id } = userReq.params;
    const { worthReadingFeedback, note } = userReq.body;

    if (
      !worthReadingFeedback ||
      !["yes", "no"].includes(worthReadingFeedback)
    ) {
      ApiResponse.error(res, 'worthReadingFeedback must be "yes" or "no"', 400);
      return;
    }

    const result = await itemService.submitFeedback(
      id,
      userReq.user.clerkUserId,
      worthReadingFeedback,
      note,
    );

    if (!result) {
      ApiResponse.error(res, "Item not found", 404);
      return;
    }

    ApiResponse.success(res, result, "Feedback submitted");
  } catch (error: any) {
    logger.error("Error in submitFeedback controller:", error);
    ApiResponse.error(res, "Failed to submit feedback", 500);
  }
};

export const deleteItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { id } = userReq.params;

    const deleted = await itemService.deleteItem(id, userReq.user.clerkUserId);

    if (!deleted) {
      ApiResponse.error(res, "Item not found", 404);
      return;
    }

    ApiResponse.success(res, null, "Item deleted successfully");
  } catch (error: any) {
    logger.error("Error in deleteItem controller:", error);
    ApiResponse.error(res, "Failed to delete item", 500);
  }
};

export const snoozeItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userReq = req as UserRequest;
    const { id } = userReq.params;

    const result = await itemService.snoozeItem(id, userReq.user.clerkUserId);

    if (!result) {
      ApiResponse.error(res, "Item not found", 404);
      return;
    }

    ApiResponse.success(res, result, "Item snoozed until tomorrow");
  } catch (error: any) {
    logger.error("Error in snoozeItem controller:", error);
    ApiResponse.error(res, "Failed to snooze item", 500);
  }
};
