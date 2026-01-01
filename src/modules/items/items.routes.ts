import { Router } from "express";
import { attachUser } from "../../middlewares/attachUser";
import { createItem } from "./items.controller";

const router = Router();

/* Articles routes */
router.post("/create-item", attachUser, createItem);

export default router;
