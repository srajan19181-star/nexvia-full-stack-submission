import type { PrismaClient } from "@nexvia/database";
import {
  createWorkspaceInputSchema,
  invitationDecisionInputSchema,
  inviteMemberInputSchema,
  updateMemberInputSchema,
  updateWorkspaceInputSchema,
  workspaceIdSchema,
} from "@nexvia/shared";
import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../config/env.js";
import { WorkspaceController } from "../controllers/workspace.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  loadWorkspaceAccess,
  requireWorkspaceAdministrator,
  requireWorkspaceOwner,
} from "../middleware/workspace-access.js";
import type { WorkspaceService } from "../services/workspace.service.js";

const workspaceParams = z.object({ workspaceId: workspaceIdSchema });
const memberParams = workspaceParams.extend({ memberId: z.string().cuid() });
const invitationParams = workspaceParams.extend({ invitationId: z.string().cuid() });

export function createWorkspaceRouter(
  prisma: PrismaClient,
  service: WorkspaceService,
  env: ApiEnv,
): Router {
  const router = Router();
  const controller = new WorkspaceController(service);
  const csrf = requireCsrf(env);
  const access = loadWorkspaceAccess(prisma);

  router.get("/", requireAuthentication, controller.list);
  router.post("/", requireAuthentication, csrf, validateBody(createWorkspaceInputSchema), controller.create);
  router.post(
    "/invitations/accept",
    requireAuthentication,
    csrf,
    validateBody(invitationDecisionInputSchema),
    controller.acceptInvitation,
  );
  router.post(
    "/invitations/reject",
    requireAuthentication,
    csrf,
    validateBody(invitationDecisionInputSchema),
    controller.rejectInvitation,
  );

  router.get("/:workspaceId", requireAuthentication, validateParams(workspaceParams), access, controller.get);
  router.patch(
    "/:workspaceId",
    requireAuthentication,
    csrf,
    validateParams(workspaceParams),
    access,
    requireWorkspaceAdministrator,
    validateBody(updateWorkspaceInputSchema),
    controller.rename,
  );
  router.delete(
    "/:workspaceId",
    requireAuthentication,
    csrf,
    validateParams(workspaceParams),
    access,
    requireWorkspaceOwner,
    controller.delete,
  );

  router.get(
    "/:workspaceId/members",
    requireAuthentication,
    validateParams(workspaceParams),
    access,
    controller.listMembers,
  );
  router.patch(
    "/:workspaceId/members/:memberId",
    requireAuthentication,
    csrf,
    validateParams(memberParams),
    access,
    requireWorkspaceAdministrator,
    validateBody(updateMemberInputSchema),
    controller.updateMember,
  );
  router.delete(
    "/:workspaceId/members/:memberId",
    requireAuthentication,
    csrf,
    validateParams(memberParams),
    access,
    requireWorkspaceAdministrator,
    controller.removeMember,
  );

  router.get(
    "/:workspaceId/invitations",
    requireAuthentication,
    validateParams(workspaceParams),
    access,
    requireWorkspaceAdministrator,
    controller.listInvitations,
  );
  router.post(
    "/:workspaceId/invitations",
    requireAuthentication,
    csrf,
    validateParams(workspaceParams),
    access,
    requireWorkspaceAdministrator,
    validateBody(inviteMemberInputSchema),
    controller.invite,
  );
  router.delete(
    "/:workspaceId/invitations/:invitationId",
    requireAuthentication,
    csrf,
    validateParams(invitationParams),
    access,
    requireWorkspaceAdministrator,
    controller.revokeInvitation,
  );

  return router;
}
