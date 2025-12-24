import { Router } from "express";
import { healthController } from "./health.controller";

const router = Router();

/**
 * Health check routes
 */
router.get("/health", (req, res) => healthController.checkHealth(req, res));

export default router;

