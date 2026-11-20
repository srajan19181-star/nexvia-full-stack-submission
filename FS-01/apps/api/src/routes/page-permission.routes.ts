import type { PrismaClient } from "@nexvia/database";
import { setPagePermissionInputSchema, workspaceIdSchema } from "@nexvia/shared";
import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../config/env.js";
import { PagePermissionController } from "../controllers/page-permission.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  loadPageAccess,
  loadWorkspaceAccess,
  requireWorkspaceAdministrator,
} from "../middleware/workspace-access.js";
import type { PagePermissionService } from "../services/page-permission.service.js";

const pageParams = z.object({ workspaceId: workspaceIdSchema, pageId: z.string().cuid() });
const permissionParams = pageParams.extend({ memberId: z.string().cuid() });

export function createPagePermissionRouter(
  prisma: PrismaClient,
  service: PagePermissionService,
  env: ApiEnv,
): Router {
  const router = Router();
  const controller = new PagePermissionController(service);
  const workspaceAccess = loadWorkspaceAccess(prisma);
  const pageAccess = loadPageAccess(prisma);
  const csrf = requireCsrf(env);

  router.get("/:workspaceId/pages/:pageId/permissions", requireAuthentication, validateParams(pageParams), workspaceAccess, pageAccess, controller.list);
  router.patch("/:workspaceId/pages/:pageId/permissions/:memberId", requireAuthentication, csrf, validateParams(permissionParams), workspaceAccess, requireWorkspaceAdministrator, pageAccess, validateBody(setPagePermissionInputSchema), controller.set);
  router.delete("/:workspaceId/pages/:pageId/permissions/:memberId", requireAuthentication, csrf, validateParams(permissionParams), workspaceAccess, requireWorkspaceAdministrator, pageAccess, controller.remove);
  return router;
}
