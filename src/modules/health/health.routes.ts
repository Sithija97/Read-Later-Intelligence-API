import { Router } from "express";
import { healthController } from "./health.controller";
import { attachUser } from "../../middlewares/attachUser";

const router = Router();

/**
 * Health check routes
 */
router.get("/health", attachUser, (req, res) =>
  healthController.checkHealth(req, res)
);

export default router;
