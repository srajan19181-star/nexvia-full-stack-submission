import type { PrismaClient } from "@nexvia/database";
import type { CreateSnapshotInput, HistoryListQuery, RestoreSnapshotInput } from "@nexvia/shared";
import { notFound } from "../lib/errors.js";
import type { RequestMetadata } from "./auth.service.js";
import type { HistoryCoordinator } from "./history-coordinator.js";

function snapshotItem(snapshot: {
  id: string;
  generation: number;
  updateId: bigint | null;
  kind: string;
  label: string | null;
  restoredFromId: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string; avatarUrl: string | null } | null;
}) {
  return {
    ...snapshot,
    updateId: snapshot.updateId?.toString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export class HistoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly coordinator: HistoryCoordinator,
  ) {}

  async list(pageId: string, query: HistoryListQuery) {
    const snapshots = await this.prisma.documentSnapshot.findMany({
      where: { pageId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
      select: {
        id: true,
        generation: true,
        updateId: true,
        kind: true,
        label: true,
        restoredFromId: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const hasMore = snapshots.length > query.limit;
    const items = hasMore ? snapshots.slice(0, query.limit) : snapshots;
    return {
      items: items.map(snapshotItem),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  }

  async preview(pageId: string, snapshotId: string) {
    const snapshot = await this.prisma.documentSnapshot.findFirst({
      where: { id: snapshotId, pageId },
      select: {
        id: true,
        generation: true,
        state: true,
        kind: true,
        label: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!snapshot) throw notFound("Document revision not found");
    return {
      ...snapshot,
      state: Buffer.from(snapshot.state).toString("base64url"),
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  create(pageId: string, input: CreateSnapshotInput, actorId: string, metadata: RequestMetadata) {
    return this.coordinator.createSnapshot({
      pageId,
      actorId,
      ...(input.label === undefined ? {} : { label: input.label }),
      activity: metadata,
    });
  }

  restore(
    pageId: string,
    snapshotId: string,
    input: RestoreSnapshotInput,
    actorId: string,
    metadata: RequestMetadata,
  ) {
    return this.coordinator.restoreSnapshot({
      pageId,
      snapshotId,
      actorId,
      ...(input.label === undefined ? {} : { label: input.label }),
      activity: metadata,
    });
  }
}
