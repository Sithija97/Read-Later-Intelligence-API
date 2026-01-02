import express, { Express } from "express";
import cors from "cors";
import { setupRoutes } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

/**
 * Create and configure Express application
 */
function createApp(): Express {
  const app: Express = express();

  // Global middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup routes
  setupRoutes(app);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;

