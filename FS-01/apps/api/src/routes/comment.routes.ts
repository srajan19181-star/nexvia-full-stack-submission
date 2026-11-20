import type { PrismaClient } from "@nexvia/database";
import {
  commentListQuerySchema,
  createCommentInputSchema,
  createCommentReplyInputSchema,
  updateCommentStatusInputSchema,
  workspaceIdSchema,
} from "@nexvia/shared";
import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../config/env.js";
import { CommentController } from "../controllers/comment.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { loadPageAccess, loadWorkspaceAccess, requirePageCommenter } from "../middleware/workspace-access.js";
import type { CommentService } from "../services/comment.service.js";

const pageParams = z.object({ workspaceId: workspaceIdSchema, pageId: z.string().cuid() });
const commentParams = pageParams.extend({ commentId: z.string().cuid() });
const replyParams = commentParams.extend({ replyId: z.string().cuid() });

export function createCommentRouter(prisma: PrismaClient, service: CommentService, env: ApiEnv): Router {
  const router = Router();
  const controller = new CommentController(service);
  const csrf = requireCsrf(env);
  const workspaceAccess = loadWorkspaceAccess(prisma);
  const pageAccess = loadPageAccess(prisma);

  router.get(
    "/:workspaceId/pages/:pageId/comments",
    requireAuthentication,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    validateQuery(commentListQuerySchema),
    controller.list,
  );
  router.post(
    "/:workspaceId/pages/:pageId/comments",
    requireAuthentication,
    csrf,
    validateParams(pageParams),
    workspaceAccess,
    pageAccess,
    requirePageCommenter,
    validateBody(createCommentInputSchema),
    controller.create,
  );
  router.post(
    "/:workspaceId/pages/:pageId/comments/:commentId/replies",
    requireAuthentication,
    csrf,
    validateParams(commentParams),
    workspaceAccess,
    pageAccess,
    requirePageCommenter,
    validateBody(createCommentReplyInputSchema),
    controller.reply,
  );
  router.patch(
    "/:workspaceId/pages/:pageId/comments/:commentId/status",
    requireAuthentication,
    csrf,
    validateParams(commentParams),
    workspaceAccess,
    pageAccess,
    requirePageCommenter,
    validateBody(updateCommentStatusInputSchema),
    controller.status,
  );
  router.delete(
    "/:workspaceId/pages/:pageId/comments/:commentId",
    requireAuthentication,
    csrf,
    validateParams(commentParams),
    workspaceAccess,
    pageAccess,
    requirePageCommenter,
    controller.deleteComment,
  );
  router.delete(
    "/:workspaceId/pages/:pageId/comments/:commentId/replies/:replyId",
    requireAuthentication,
    csrf,
    validateParams(replyParams),
    workspaceAccess,
    pageAccess,
    requirePageCommenter,
    controller.deleteReply,
  );
  return router;
}
