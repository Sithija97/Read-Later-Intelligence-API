import { Express } from "express";
import authRoutes from "./modules/auth/auth.routes";
import itemsRoutes from "./modules/items/items.routes";
import healthRoutes from "./modules/health/health.routes";

/**
 * Combine all module routes
 */
export function setupRoutes(app: Express): void {
  // Health check routes
  app.use("/api/v1", healthRoutes);

  // Authentication routes
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/items", itemsRoutes);
}
