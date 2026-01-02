import { Router } from "express";
import { checkHealth } from "./health.controller";
import { attachUser } from "../../middlewares/attachUser";

const router = Router();

/**
 * Health check routes
 */
router.get("/health", attachUser, checkHealth);

export default router;
