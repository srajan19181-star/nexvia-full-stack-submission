import type { Prisma, PrismaClient } from "@nexvia/database";
import type { ActivityAction } from "@nexvia/shared";

type ActivityClient = Pick<PrismaClient, "activityLog"> | Prisma.TransactionClient;

export interface ActivityInput {
  workspaceId: string;
  pageId?: string;
  actorId?: string;
  action: ActivityAction;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordActivity(client: ActivityClient, input: ActivityInput): Promise<void> {
  await client.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: input.entityType,
      ...(input.pageId === undefined ? {} : { pageId: input.pageId }),
      ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
      ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      ...(input.ipAddress === undefined ? {} : { ipAddress: input.ipAddress }),
      ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
    },
  });
}
