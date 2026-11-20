import { randomBytes } from "node:crypto";
import {
  ContentRole,
  InvitationStatus,
  type PrismaClient,
  WorkspaceRole,
} from "@nexvia/database";
import {
  activityActions,
  type CreateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberInput,
  type UpdateWorkspaceInput,
} from "@nexvia/shared";
import type { Logger } from "pino";
import { createOpaqueToken, hashToken } from "../lib/crypto.js";
import { AppError, conflict, forbidden, notFound } from "../lib/errors.js";
import type { RequestMetadata } from "./auth.service.js";
import type { Mailer } from "./email.service.js";
import { recordActivity } from "./activity.service.js";

export interface WorkspaceActor {
  userId: string;
  name: string;
  workspaceRole: WorkspaceRole;
}

function workspaceSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "workspace"}-${randomBytes(4).toString("hex")}`;
}

export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mailer: Mailer,
    private readonly logger: Logger,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                pages: { where: { deletedAt: null } },
              },
            },
          },
        },
      },
    });

    return memberships.map(({ workspace, ...membership }) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      workspaceRole: membership.workspaceRole,
      contentRole: membership.contentRole,
      memberCount: workspace._count.members,
      pageCount: workspace._count.pages,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    }));
  }

  async create(userId: string, input: CreateWorkspaceInput, metadata: RequestMetadata) {
    return this.prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.create({
        data: {
          name: input.name,
          slug: workspaceSlug(input.name),
          createdById: userId,
          members: {
            create: {
              userId,
              workspaceRole: WorkspaceRole.OWNER,
              contentRole: ContentRole.EDITOR,
            },
          },
        },
      });

      await recordActivity(transaction, {
        workspaceId: workspace.id,
        actorId: userId,
        action: activityActions.workspaceCreated,
        entityType: "workspace",
        entityId: workspace.id,
        metadata: { name: workspace.name },
        ...metadata,
      });

      return {
        ...workspace,
        workspaceRole: WorkspaceRole.OWNER,
        contentRole: ContentRole.EDITOR,
        memberCount: 1,
        pageCount: 0,
      };
    });
  }

  async getOverview(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, pages: { where: { deletedAt: null } } } },
          },
        },
      },
    });

    if (!membership) {
      throw notFound("Workspace not found");
    }

    return {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      workspaceRole: membership.workspaceRole,
      contentRole: membership.contentRole,
      memberCount: membership.workspace._count.members,
      pageCount: membership.workspace._count.pages,
      createdAt: membership.workspace.createdAt.toISOString(),
      updatedAt: membership.workspace.updatedAt.toISOString(),
    };
  }

  async rename(
    workspaceId: string,
    input: UpdateWorkspaceInput,
    actor: WorkspaceActor,
    metadata: RequestMetadata,
  ) {
    this.assertAdministrator(actor.workspaceRole);
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.workspace.findUnique({ where: { id: workspaceId } });
      if (!previous) {
        throw notFound("Workspace not found");
      }
      const workspace = await transaction.workspace.update({
        where: { id: workspaceId },
        data: { name: input.name },
      });
      await recordActivity(transaction, {
        workspaceId,
        actorId: actor.userId,
        action: activityActions.workspaceRenamed,
        entityType: "workspace",
        entityId: workspaceId,
        metadata: { previousName: previous.name, name: workspace.name },
        ...metadata,
      });
      return workspace;
    });
  }

  async delete(workspaceId: string, actor: WorkspaceActor): Promise<void> {
    if (actor.workspaceRole !== WorkspaceRole.OWNER) {
      throw forbidden("Only the workspace owner can delete this workspace");
    }
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async listMembers(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ workspaceRole: "asc" }, { joinedAt: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    return members.map((member) => ({
      id: member.id,
      user: member.user,
      workspaceRole: member.workspaceRole,
      contentRole: member.contentRole,
      joinedAt: member.joinedAt.toISOString(),
    }));
  }

  async updateMember(
    workspaceId: string,
    memberId: string,
    input: UpdateMemberInput,
    actor: WorkspaceActor,
    metadata: RequestMetadata,
  ) {
    this.assertAdministrator(actor.workspaceRole);
    const target = await this.prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!target) {
      throw notFound("Workspace member not found");
    }
    if (target.workspaceRole === WorkspaceRole.OWNER) {
      throw forbidden("The owner role cannot be changed");
    }
    if (actor.workspaceRole === WorkspaceRole.ADMIN) {
      if (target.workspaceRole === WorkspaceRole.ADMIN || input.workspaceRole === "ADMIN") {
        throw forbidden("Only the owner can manage administrators");
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const member = await transaction.workspaceMember.update({
        where: { id: memberId },
        data: {
          ...(input.workspaceRole === undefined ? {} : { workspaceRole: input.workspaceRole }),
          ...(input.contentRole === undefined ? {} : { contentRole: input.contentRole }),
        },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
      await recordActivity(transaction, {
        workspaceId,
        actorId: actor.userId,
        action: activityActions.memberPermissionChanged,
        entityType: "workspace_member",
        entityId: memberId,
        metadata: {
          targetUserId: target.userId,
          previousWorkspaceRole: target.workspaceRole,
          previousContentRole: target.contentRole,
          workspaceRole: member.workspaceRole,
          contentRole: member.contentRole,
        },
        ...metadata,
      });
      return member;
    });
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    actor: WorkspaceActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    this.assertAdministrator(actor.workspaceRole);
    const target = await this.prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!target) {
      throw notFound("Workspace member not found");
    }
    if (target.workspaceRole === WorkspaceRole.OWNER) {
      throw forbidden("The workspace owner cannot be removed");
    }
    if (actor.workspaceRole === WorkspaceRole.ADMIN && target.workspaceRole === WorkspaceRole.ADMIN) {
      throw forbidden("Only the owner can remove an administrator");
    }

    await this.prisma.$transaction(async (transaction) => {
      await recordActivity(transaction, {
        workspaceId,
        actorId: actor.userId,
        action: activityActions.memberRemoved,
        entityType: "workspace_member",
        entityId: memberId,
        metadata: { targetUserId: target.userId },
        ...metadata,
      });
      await transaction.workspaceMember.delete({ where: { id: memberId } });
    });
  }

  async listInvitations(workspaceId: string, actor: WorkspaceActor) {
    this.assertAdministrator(actor.workspaceRole);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { id: true, name: true } } },
    });
    return invitations.map(({ tokenHash: _tokenHash, ...invitation }) => invitation);
  }

  async invite(
    workspaceId: string,
    input: InviteMemberInput,
    actor: WorkspaceActor,
    metadata: RequestMetadata,
  ) {
    this.assertAdministrator(actor.workspaceRole);
    if (actor.workspaceRole === WorkspaceRole.ADMIN && input.workspaceRole === "ADMIN") {
      throw forbidden("Only the owner can invite an administrator");
    }

    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, user: { email: input.email } },
      select: { id: true },
    });
    if (existingMember) {
      throw conflict("This person is already a workspace member", "ALREADY_A_MEMBER");
    }

    const token = createOpaqueToken(32);
    const tokenHash = hashToken(token);
    const invitation = await this.prisma.$transaction(async (transaction) => {
      await transaction.workspaceInvitation.updateMany({
        where: { workspaceId, email: input.email, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.REVOKED, respondedAt: new Date() },
      });
      const created = await transaction.workspaceInvitation.create({
        data: {
          workspaceId,
          email: input.email,
          tokenHash,
          workspaceRole: input.workspaceRole,
          contentRole: input.contentRole,
          invitedById: actor.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
        },
        include: { workspace: true },
      });
      await recordActivity(transaction, {
        workspaceId,
        actorId: actor.userId,
        action: activityActions.memberInvited,
        entityType: "workspace_invitation",
        entityId: created.id,
        metadata: {
          email: input.email,
          workspaceRole: input.workspaceRole,
          contentRole: input.contentRole,
        },
        ...metadata,
      });
      return created;
    });

    try {
      await this.mailer.sendWorkspaceInvitation({
        email: invitation.email,
        inviterName: actor.name,
        workspaceName: invitation.workspace.name,
        token,
      });
    } catch (error) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.REVOKED, respondedAt: new Date() },
      });
      this.logger.error({ error, invitationId: invitation.id }, "Workspace invitation delivery failed");
      throw new AppError({
        statusCode: 503,
        code: "INVITATION_DELIVERY_FAILED",
        message: "The invitation could not be delivered. Try again later.",
      });
    }

    const { tokenHash: _tokenHash, workspace: _workspace, ...safeInvitation } = invitation;
    return safeInvitation;
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actor: WorkspaceActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    this.assertAdministrator(actor.workspaceRole);
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId, status: InvitationStatus.PENDING },
    });
    if (!invitation) {
      throw notFound("Pending invitation not found");
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED, respondedAt: new Date() },
      });
      await recordActivity(transaction, {
        workspaceId,
        actorId: actor.userId,
        action: activityActions.invitationRevoked,
        entityType: "workspace_invitation",
        entityId: invitationId,
        metadata: { email: invitation.email },
        ...metadata,
      });
    });
  }

  async acceptInvitation(token: string, userId: string, email: string, metadata: RequestMetadata) {
    return this.decideInvitation(token, userId, email, true, metadata);
  }

  async rejectInvitation(token: string, userId: string, email: string, metadata: RequestMetadata) {
    return this.decideInvitation(token, userId, email, false, metadata);
  }

  private async decideInvitation(
    token: string,
    userId: string,
    email: string,
    accept: boolean,
    metadata: RequestMetadata,
  ) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { workspace: true },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new AppError({ statusCode: 400, code: "INVALID_INVITATION", message: "This invitation is invalid" });
    }
    if (invitation.expiresAt <= new Date()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED, respondedAt: new Date() },
      });
      throw new AppError({ statusCode: 400, code: "INVITATION_EXPIRED", message: "This invitation has expired" });
    }
    if (invitation.email !== email.toLowerCase()) {
      throw forbidden("This invitation was issued to a different email address");
    }

    return this.prisma.$transaction(async (transaction) => {
      if (accept) {
        await transaction.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
          create: {
            workspaceId: invitation.workspaceId,
            userId,
            workspaceRole: invitation.workspaceRole,
            contentRole: invitation.contentRole,
          },
          update: {
            workspaceRole: invitation.workspaceRole,
            contentRole: invitation.contentRole,
          },
        });
      }
      await transaction.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: accept ? InvitationStatus.ACCEPTED : InvitationStatus.REJECTED,
          respondedAt: new Date(),
          acceptedById: accept ? userId : null,
        },
      });
      await recordActivity(transaction, {
        workspaceId: invitation.workspaceId,
        actorId: userId,
        action: accept ? activityActions.invitationAccepted : activityActions.invitationRejected,
        entityType: "workspace_invitation",
        entityId: invitation.id,
        metadata: { email: invitation.email },
        ...metadata,
      });
      return {
        accepted: accept,
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          slug: invitation.workspace.slug,
        },
      };
    });
  }

  private assertAdministrator(role: WorkspaceRole): void {
    if (role !== WorkspaceRole.OWNER && role !== WorkspaceRole.ADMIN) {
      throw forbidden("Workspace administration permission is required");
    }
  }
}
