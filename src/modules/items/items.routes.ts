import { Router } from "express";
import { attachUser } from "../../middlewares/attachUser";
import {
  createItem,
  getItems,
  getItemById,
  getTodaysItems,
  completeItem,
  submitFeedback,
  deleteItem,
  snoozeItem,
} from "./items.controller";

const router = Router();

/* Items routes */
router.post("/create-item", attachUser, createItem);
router.get("/items", attachUser, getItems);
router.get("/today", attachUser, getTodaysItems);
router.get("/items/:id", attachUser, getItemById);
router.patch("/items/:id/complete", attachUser, completeItem);
router.patch("/items/:id/feedback", attachUser, submitFeedback);
router.patch("/items/:id/snooze", attachUser, snoozeItem);
router.delete("/items/:id", attachUser, deleteItem);

export default router;
