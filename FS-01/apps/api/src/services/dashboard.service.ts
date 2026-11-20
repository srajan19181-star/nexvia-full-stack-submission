import type { PrismaClient } from "@nexvia/database";
import type { WorkspaceService } from "./workspace.service.js";

export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly workspaces: WorkspaceService,
  ) {}

  async get(userId: string) {
    const [workspaceItems, recentPages, recentActivity] = await Promise.all([
      this.workspaces.listForUser(userId),
      this.prisma.page.findMany({
        where: { deletedAt: null, workspace: { members: { some: { userId } } } },
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          workspace: { select: { id: true, name: true } },
          favorites: { where: { userId }, select: { userId: true } },
        },
      }),
      this.prisma.activityLog.findMany({
        where: { workspace: { members: { some: { userId } } } },
        take: 10,
        orderBy: { id: "desc" },
        include: {
          workspace: { select: { id: true, name: true } },
          actor: { select: { id: true, name: true, avatarUrl: true } },
          page: { select: { id: true, title: true, icon: true } },
        },
      }),
    ]);

    return {
      workspaces: workspaceItems,
      recentPages: recentPages.map(({ favorites, ...page }) => ({
        ...page,
        isFavorite: favorites.length > 0,
      })),
      activity: recentActivity.map((activity) => ({ ...activity, id: activity.id.toString() })),
    };
  }
}
