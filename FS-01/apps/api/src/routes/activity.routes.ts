import type { PrismaClient } from "@nexvia/database";
import { paginationInputSchema, workspaceIdSchema } from "@nexvia/shared";
import { Router } from "express";
import { z } from "zod";
import { ActivityController } from "../controllers/activity.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { loadWorkspaceAccess } from "../middleware/workspace-access.js";
import type { ActivityLogService } from "../services/activity-log.service.js";

export function createActivityRouter(prisma: PrismaClient, service: ActivityLogService): Router {
  const router = Router();
  const controller = new ActivityController(service);
  router.get(
    "/:workspaceId/activity",
    requireAuthentication,
    validateParams(z.object({ workspaceId: workspaceIdSchema })),
    loadWorkspaceAccess(prisma),
    validateQuery(paginationInputSchema),
    controller.list,
  );
  return router;
}
