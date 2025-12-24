import { Router } from "express";
import { requireClerkAuth } from "../../middlewares/requireClerkAuth";
import { authController } from "./auth.controller";

const router = Router();

/**
 * Authentication routes
 */
router.post("/sync-user", requireClerkAuth, (req, res) =>
  authController.syncUser(req, res)
);

export default router;

