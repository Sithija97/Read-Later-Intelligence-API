import { Router } from "express";
import { attachUser } from "../../middlewares/attachUser";
import { createItem, getItems, getItemById } from "./items.controller";

const router = Router();

/* Items routes */
router.post("/create-item", attachUser, createItem);
router.get("/items", attachUser, getItems);
router.get("/items/:id", attachUser, getItemById);

export default router;
