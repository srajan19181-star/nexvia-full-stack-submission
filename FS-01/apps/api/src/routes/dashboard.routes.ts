import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import type { DashboardService } from "../services/dashboard.service.js";

export function createDashboardRouter(service: DashboardService): Router {
  const router = Router();
  const controller = new DashboardController(service);
  router.get("/", requireAuthentication, controller.get);
  return router;
}
