import { type PrismaClient, WorkspaceRole } from "@nexvia/database";
import { calculateEffectivePermissions } from "@nexvia/shared";
import type { NextFunction, Request, Response } from "express";
import { forbidden, notFound } from "../lib/errors.js";
import { routeParam } from "../lib/route-param.js";

export function loadWorkspaceAccess(prisma: PrismaClient) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const workspaceId = routeParam(request, "workspaceId");
    if (!request.auth) {
      next(notFound("Workspace not found"));
      return;
    }
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: request.auth.user.id } },
    });
    if (!membership) {
      next(notFound("Workspace not found"));
      return;
    }
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      next(notFound("Workspace not found"));
      return;
    }
    request.workspaceAccess = {
      workspace,
      membership,
      permissions: calculateEffectivePermissions({
        workspaceRole: membership.workspaceRole,
        contentRole: membership.contentRole,
      }),
    };
    next();
  };
}

export function requireWorkspaceAdministrator(request: Request, _response: Response, next: NextFunction): void {
  const role = request.workspaceAccess?.membership.workspaceRole;
  if (role !== WorkspaceRole.OWNER && role !== WorkspaceRole.ADMIN) {
    next(forbidden("Workspace administration permission is required"));
    return;
  }
  next();
}

export function requireWorkspaceOwner(request: Request, _response: Response, next: NextFunction): void {
  if (request.workspaceAccess?.membership.workspaceRole !== WorkspaceRole.OWNER) {
    next(forbidden("Workspace owner permission is required"));
    return;
  }
  next();
}

export function loadPageAccess(prisma: PrismaClient, options: { includeDeleted?: boolean } = {}) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const workspaceAccess = request.workspaceAccess;
    if (!workspaceAccess) {
      next(notFound("Page not found"));
      return;
    }
    const pageId = routeParam(request, "pageId");
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        workspaceId: workspaceAccess.workspace.id,
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
    });
    if (!page) {
      next(notFound("Page not found"));
      return;
    }
    const override = await prisma.pagePermission.findUnique({
      where: { pageId_memberId: { pageId, memberId: workspaceAccess.membership.id } },
      select: { role: true },
    });
    const pageRole = override?.role ?? null;
    request.pageAccess = {
      page,
      pageRole,
      permissions: calculateEffectivePermissions({
        workspaceRole: workspaceAccess.membership.workspaceRole,
        contentRole: workspaceAccess.membership.contentRole,
        pageRole,
      }),
    };
    next();
  };
}

export function requirePageEditor(request: Request, _response: Response, next: NextFunction): void {
  if (!request.pageAccess?.permissions.edit) {
    next(forbidden("Editor permission is required"));
    return;
  }
  next();
}

export function requirePageCommenter(request: Request, _response: Response, next: NextFunction): void {
  if (!request.pageAccess?.permissions.comment) {
    next(forbidden("Comment permission is required"));
    return;
  }
  next();
}
