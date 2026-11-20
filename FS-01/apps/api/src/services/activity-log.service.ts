import type { PrismaClient } from "@nexvia/database";

export class ActivityLogService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(workspaceId: string, limit: number, cursor?: string) {
    const cursorId = cursor ? BigInt(cursor) : undefined;
    const records = await this.prisma.activityLog.findMany({
      where: { workspaceId, ...(cursorId === undefined ? {} : { id: { lt: cursorId } }) },
      take: limit + 1,
      orderBy: { id: "desc" },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
        page: { select: { id: true, title: true, icon: true } },
      },
    });
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    return {
      items: page.map((record) => ({ ...record, id: record.id.toString() })),
      nextCursor: hasMore ? page.at(-1)?.id.toString() ?? null : null,
    };
  }
}
