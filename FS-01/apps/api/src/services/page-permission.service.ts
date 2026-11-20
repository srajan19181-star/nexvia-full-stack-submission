import { WorkspaceRole, type PrismaClient } from "@nexvia/database";
import { activityActions, calculateEffectivePermissions, type SetPagePermissionInput } from "@nexvia/shared";
import { forbidden, notFound } from "../lib/errors.js";
import type { RequestMetadata } from "./auth.service.js";
import { recordActivity } from "./activity.service.js";

export class PagePermissionService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(workspaceId: string, pageId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ workspaceRole: "asc" }, { joinedAt: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        pagePermissions: { where: { pageId }, take: 1, select: { role: true, updatedAt: true } },
      },
    });
    return members.map(({ pagePermissions, ...member }) => {
      const pageRole = pagePermissions[0]?.role ?? null;
      return {
        ...member,
        pageRole,
        permissionUpdatedAt: pagePermissions[0]?.updatedAt.toISOString() ?? null,
        effectivePermissions: calculateEffectivePermissions({
          workspaceRole: member.workspaceRole,
          contentRole: member.contentRole,
          pageRole,
        }),
      };
    });
  }

  async set(
    workspaceId: string,
    pageId: string,
    memberId: string,
    input: SetPagePermissionInput,
    actorId: string,
    metadata: RequestMetadata,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) throw notFound("Workspace member not found");
    if (member.workspaceRole === WorkspaceRole.OWNER || member.workspaceRole === WorkspaceRole.ADMIN) {
      throw forbidden("Workspace administrators always have full page access");
    }

    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.pagePermission.findUnique({
        where: { pageId_memberId: { pageId, memberId } },
      });
      const permission = await transaction.pagePermission.upsert({
        where: { pageId_memberId: { pageId, memberId } },
        create: { pageId, memberId, role: input.role, grantedById: actorId },
        update: { role: input.role, grantedById: actorId },
      });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId,
        action: activityActions.pagePermissionChanged,
        entityType: "page_permission",
        entityId: permission.id,
        metadata: {
          memberId,
          targetUserId: member.userId,
          previousRole: previous?.role ?? null,
          role: permission.role,
        },
        ...metadata,
      });
      return permission;
    });
  }

  async remove(
    workspaceId: string,
    pageId: string,
    memberId: string,
    actorId: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) throw notFound("Workspace member not found");
    const permission = await this.prisma.pagePermission.findUnique({
      where: { pageId_memberId: { pageId, memberId } },
    });
    if (!permission) return;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.pagePermission.delete({ where: { id: permission.id } });
      await recordActivity(transaction, {
        workspaceId,
        pageId,
        actorId,
        action: activityActions.pagePermissionRemoved,
        entityType: "page_permission",
        entityId: permission.id,
        metadata: { memberId, targetUserId: member.userId, previousRole: permission.role },
        ...metadata,
      });
    });
  }
}
