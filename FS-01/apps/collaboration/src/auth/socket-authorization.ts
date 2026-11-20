import type { IncomingMessage } from "node:http";
import type { PrismaClient } from "@nexvia/database";
import { calculateEffectivePermissions, type EffectivePermissions } from "@nexvia/shared";
import { hashKeyedToken } from "@nexvia/shared/server-crypto";
import type { CollaborationEnv } from "../config/env.js";
import { websocketClose } from "../protocol/constants.js";

export interface SocketPrincipal {
  sessionId: string;
  pageId: string;
  workspaceId: string;
  generation: number;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  permissions: EffectivePermissions;
}

export class SocketAuthorizationError extends Error {
  constructor(
    message: string,
    readonly closeCode: number,
  ) {
    super(message);
    this.name = "SocketAuthorizationError";
  }
}

function cookies(header: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  if (!header) return result;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try {
      result.set(name, decodeURIComponent(rawValue));
    } catch {
      result.set(name, rawValue);
    }
  }
  return result;
}

export class SocketAuthorizationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: CollaborationEnv,
  ) {}

  async authorizeRequest(request: IncomingMessage, pageId: string, requestedGeneration: number): Promise<SocketPrincipal> {
    const sessionToken = cookies(request.headers.cookie).get(this.env.SESSION_COOKIE_NAME);
    if (!sessionToken) {
      throw new SocketAuthorizationError("Authentication required", websocketClose.unauthorized);
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashKeyedToken(sessionToken, this.env.SESSION_SECRET) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        lastSeenAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new SocketAuthorizationError("Session expired", websocketClose.unauthorized);
    }

    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
      void this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    }

    const principal = await this.resolvePageAccess(session.id, session.userId, session.user, pageId);
    if (principal.generation !== requestedGeneration) {
      throw new SocketAuthorizationError("Document generation changed", websocketClose.documentRestored);
    }
    return principal;
  }

  async refresh(principal: SocketPrincipal): Promise<SocketPrincipal> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: principal.sessionId,
        userId: principal.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      throw new SocketAuthorizationError("Session expired", websocketClose.unauthorized);
    }
    const refreshed = await this.resolvePageAccess(principal.sessionId, principal.user.id, principal.user, principal.pageId);
    if (refreshed.generation !== principal.generation) {
      throw new SocketAuthorizationError("Document generation changed", websocketClose.documentRestored);
    }
    return refreshed;
  }

  private async resolvePageAccess(
    sessionId: string,
    userId: string,
    user: SocketPrincipal["user"],
    pageId: string,
  ): Promise<SocketPrincipal> {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { id: true, workspaceId: true, documentState: { select: { generation: true } } },
    });
    if (!page) {
      throw new SocketAuthorizationError("Page not found", websocketClose.notFound);
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: page.workspaceId, userId } },
      select: {
        id: true,
        workspaceRole: true,
        contentRole: true,
        pagePermissions: {
          where: { pageId },
          take: 1,
          select: { role: true },
        },
      },
    });
    if (!membership) {
      throw new SocketAuthorizationError("Page access revoked", websocketClose.forbidden);
    }

    const permissions = calculateEffectivePermissions({
      workspaceRole: membership.workspaceRole,
      contentRole: membership.contentRole,
      pageRole: membership.pagePermissions[0]?.role ?? null,
    });
    if (!permissions.view) {
      throw new SocketAuthorizationError("View permission required", websocketClose.forbidden);
    }

    return {
      sessionId,
      pageId,
      workspaceId: page.workspaceId,
      generation: page.documentState?.generation ?? 1,
      user,
      permissions,
    };
  }
}
