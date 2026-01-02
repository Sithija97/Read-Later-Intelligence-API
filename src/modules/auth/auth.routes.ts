import { Router } from "express";
import { requireClerkAuth } from "../../middlewares/requireClerkAuth";
import { syncUser } from "./auth.controller";

const router = Router();

/**
 * Authentication routes
 */
router.post("/sync-user", requireClerkAuth, syncUser);

export default router;

