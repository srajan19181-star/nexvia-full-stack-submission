import type { PrismaClient } from "@nexvia/database";
import {
  createSnapshotInputSchema,
  historyListQuerySchema,
  restoreSnapshotInputSchema,
  workspaceIdSchema,
} from "@nexvia/shared";
import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../config/env.js";
import { HistoryController } from "../controllers/history.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { loadPageAccess, loadWorkspaceAccess, requirePageEditor } from "../middleware/workspace-access.js";
import type { HistoryService } from "../services/history.service.js";

const pageParams = z.object({ workspaceId: workspaceIdSchema, pageId: z.string().cuid() });
const snapshotParams = pageParams.extend({ snapshotId: z.string().cuid() });

export function createHistoryRouter(prisma: PrismaClient, service: HistoryService, env: ApiEnv): Router {
  const router = Router();
  const controller = new HistoryController(service);
  const csrf = requireCsrf(env);
  const workspaceAccess = loadWorkspaceAccess(prisma);
  const pageAccess = loadPageAccess(prisma);

  router.get("/:workspaceId/pages/:pageId/history", requireAuthentication, validateParams(pageParams), workspaceAccess, pageAccess, validateQuery(historyListQuerySchema), controller.list);
  router.get("/:workspaceId/pages/:pageId/history/:snapshotId", requireAuthentication, validateParams(snapshotParams), workspaceAccess, pageAccess, controller.preview);
  router.post("/:workspaceId/pages/:pageId/history", requireAuthentication, csrf, validateParams(pageParams), workspaceAccess, pageAccess, requirePageEditor, validateBody(createSnapshotInputSchema), controller.create);
  router.post("/:workspaceId/pages/:pageId/history/:snapshotId/restore", requireAuthentication, csrf, validateParams(snapshotParams), workspaceAccess, pageAccess, requirePageEditor, validateBody(restoreSnapshotInputSchema), controller.restore);
  return router;
}
