import type { PrismaClient } from "@nexvia/database";
import {
  createPageInputSchema,
  pageListQuerySchema,
  reorderPagesInputSchema,
  updatePageInputSchema,
  workspaceIdSchema,
  workspaceSearchQuerySchema,
} from "@nexvia/shared";
import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../config/env.js";
import { PageController } from "../controllers/page.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { loadPageAccess, loadWorkspaceAccess, requirePageEditor } from "../middleware/workspace-access.js";
import type { PageService } from "../services/page.service.js";

const workspaceParams = z.object({ workspaceId: workspaceIdSchema });
const pageParams = workspaceParams.extend({ pageId: z.string().cuid() });

export function createPageRouter(prisma: PrismaClient, service: PageService, env: ApiEnv): Router {
  const router = Router();
  const controller = new PageController(service);
  const csrf = requireCsrf(env);
  const workspaceAccess = loadWorkspaceAccess(prisma);
  const pageAccess = loadPageAccess(prisma);
  const deletedPageAccess = loadPageAccess(prisma, { includeDeleted: true });

  router.get(
    "/:workspaceId/pages",
    requireAuthentication,
    validateParams(workspaceParams),
    workspaceAccess,
    validateQuery(pageListQuerySchema),
    controller.list,
  );
  router.post(
    "/:workspaceId/pages",
    requireAuthentication,
    csrf,
    validateParams(workspaceParams),
    workspaceAccess,
    validateBody(createPageInputSchema),
    controller.create,
  );
  router.post(
    "/:workspaceId/pages/reorder",
    requireAuthentication,
    csrf,
    validateParams(workspaceParams),
    workspaceAccess,
    validateBody(reorderPagesInputSchema),
    controller.reorder,
  );
  router.get(
    "/:workspaceId/pages/:pageId",
    requireAuthentication,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    controller.get,
  );
  router.patch(
    "/:workspaceId/pages/:pageId",
    requireAuthentication,
    csrf,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    requirePageEditor,
    validateBody(updatePageInputSchema),
    controller.update,
  );
  router.delete(
    "/:workspaceId/pages/:pageId",
    requireAuthentication,
    csrf,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    requirePageEditor,
    controller.delete,
  );
  router.post(
    "/:workspaceId/pages/:pageId/restore",
    requireAuthentication,
    csrf,
    validateParams(pageParams),
    workspaceAccess,
    deletedPageAccess,
    requirePageEditor,
    controller.restore,
  );
  router.post(
    "/:workspaceId/pages/:pageId/favorite",
    requireAuthentication,
    csrf,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    controller.favorite,
  );
  router.delete(
    "/:workspaceId/pages/:pageId/favorite",
    requireAuthentication,
    csrf,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    controller.unfavorite,
  );

  return router;
}

export function createSearchRouter(service: PageService): Router {
  const router = Router();
  const controller = new PageController(service);
  router.get("/", requireAuthentication, validateQuery(workspaceSearchQuerySchema), controller.search);
  return router;
}
