import { createHash } from "node:crypto";
import { Prisma, SnapshotKind, type PrismaClient } from "@nexvia/database";
import { activityActions } from "@nexvia/shared";
import * as Y from "yjs";

const persistenceOrigin = Symbol("nexvia-persistence");

export interface LoadedYjsDocument {
  document: Y.Doc;
  generation: number;
  lastUpdateId: bigint;
  version: bigint;
}

export interface PersistedUpdate {
  id: bigint;
  deduplicated: boolean;
  hash: string;
}

export interface DurableUpdate {
  id: bigint;
  generation: number;
  update: Uint8Array;
}

export interface DurableReplay {
  generation: number;
  compactedState: Uint8Array | null;
  compactedThroughUpdateId: bigint | null;
  updates: DurableUpdate[];
}

export class DocumentGenerationChangedError extends Error {
  constructor() {
    super("The active document generation changed");
    this.name = "DocumentGenerationChangedError";
  }
}

export class SnapshotNotFoundError extends Error {
  constructor() {
    super("Document snapshot not found");
    this.name = "SnapshotNotFoundError";
  }
}

export interface SnapshotActivityMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface RestoreResult {
  snapshotId: string;
  preRestoreSnapshotId: string;
  generation: number;
}

function bytes(value: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function updateHash(update: Uint8Array): string {
  return createHash("sha256").update(update).digest("base64url");
}

function collaborativePlainText(document: Y.Doc): string {
  const text: string[] = [];
  const visit = (node: Y.XmlFragment | Y.XmlElement | Y.XmlText | Y.Text | Y.XmlHook): void => {
    if (node instanceof Y.XmlText || node instanceof Y.Text) {
      const value = node.toString().trim();
      if (value) text.push(value);
      return;
    }
    if (node instanceof Y.XmlFragment || node instanceof Y.XmlElement) {
      for (const child of node.toArray()) visit(child);
    }
  };
  visit(document.getXmlFragment("default"));
  return text.join("\n").slice(0, 1_000_000);
}

export class YjsPersistence {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly instanceId: string,
  ) {}

  async loadDocument(pageId: string): Promise<LoadedYjsDocument> {
    const initialDocument = new Y.Doc();
    const initialState = Y.encodeStateAsUpdate(initialDocument);
    const initialStateVector = Y.encodeStateVector(initialDocument);
    initialDocument.destroy();

    const state = await this.prisma.documentState.upsert({
      where: { pageId },
      create: {
        pageId,
        state: bytes(initialState),
        stateVector: bytes(initialStateVector),
      },
      update: {},
    });

    const document = new Y.Doc();
    Y.applyUpdate(document, bytes(state.state), persistenceOrigin);

    const updates = await this.prisma.documentUpdate.findMany({
      where: {
        pageId,
        generation: state.generation,
        ...(state.compactedThroughUpdateId === null
          ? {}
          : { id: { gt: state.compactedThroughUpdateId } }),
      },
      orderBy: { id: "asc" },
      select: { id: true, update: true },
    });

    for (const update of updates) {
      Y.applyUpdate(document, bytes(update.update), persistenceOrigin);
    }

    const lastUpdateId = updates.at(-1)?.id ?? state.compactedThroughUpdateId ?? 0n;
    return {
      document,
      generation: state.generation,
      lastUpdateId,
      version: state.version,
    };
  }

  async appendUpdate(
    pageId: string,
    generation: number,
    update: Uint8Array,
    actorId: string | null,
  ): Promise<PersistedUpdate> {
    const hash = updateHash(update);

    try {
      const persisted = await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.documentUpdate.create({
          data: {
            pageId,
            generation,
            update: bytes(update),
            updateHash: hash,
            actorId,
            instanceId: this.instanceId,
          },
          select: { id: true },
        });

        const claimed = await transaction.documentState.updateMany({
          where: { pageId, generation },
          data: { version: { increment: 1n } },
        });
        if (claimed.count !== 1) {
          throw new DocumentGenerationChangedError();
        }

        return row;
      });

      return { id: persisted.id, deduplicated: false, hash };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.documentUpdate.findUnique({
          where: { pageId_generation_updateHash: { pageId, generation, updateHash: hash } },
          select: { id: true },
        });
        if (existing) {
          return { id: existing.id, deduplicated: true, hash };
        }
      }
      throw error;
    }
  }

  async updatesAfter(pageId: string, generation: number, updateId: bigint): Promise<DurableUpdate[]> {
    const updates = await this.prisma.documentUpdate.findMany({
      where: { pageId, generation, id: { gt: updateId } },
      orderBy: { id: "asc" },
      select: { id: true, generation: true, update: true },
    });
    return updates.map((update) => ({
      id: update.id,
      generation: update.generation,
      update: bytes(update.update),
    }));
  }

  async currentGeneration(pageId: string): Promise<number | null> {
    const state = await this.prisma.documentState.findUnique({
      where: { pageId },
      select: { generation: true },
    });
    return state?.generation ?? null;
  }

  async replayAfter(pageId: string, generation: number, updateId: bigint): Promise<DurableReplay> {
    const state = await this.prisma.documentState.findUnique({
      where: { pageId },
      select: { generation: true, state: true, compactedThroughUpdateId: true },
    });
    if (!state) throw new DocumentGenerationChangedError();
    const applyCompactedState = state.generation === generation
      && state.compactedThroughUpdateId !== null
      && state.compactedThroughUpdateId > updateId;
    const replayFrom = applyCompactedState ? state.compactedThroughUpdateId! : updateId;
    const updates = state.generation === generation
      ? await this.updatesAfter(pageId, generation, replayFrom)
      : [];
    return {
      generation: state.generation,
      compactedState: applyCompactedState ? bytes(state.state) : null,
      compactedThroughUpdateId: applyCompactedState ? state.compactedThroughUpdateId : null,
      updates,
    };
  }

  async compact(
    pageId: string,
    generation: number,
    document: Y.Doc,
    throughUpdateId: bigint,
  ): Promise<boolean> {
    if (throughUpdateId <= 0n) {
      return false;
    }

    const state = Y.encodeStateAsUpdate(document);
    const stateVector = Y.encodeStateVector(document);
    const plainText = collaborativePlainText(document);

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.documentState.updateMany({
        where: {
          pageId,
          generation,
          OR: [
            { compactedThroughUpdateId: null },
            { compactedThroughUpdateId: { lt: throughUpdateId } },
          ],
        },
        data: {
          state: bytes(state),
          stateVector: bytes(stateVector),
          compactedThroughUpdateId: throughUpdateId,
          lastCompactedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        return false;
      }

      await transaction.documentSearchIndex.upsert({
        where: { pageId },
        create: { pageId, plainText },
        update: { plainText },
      });

      await transaction.documentUpdate.deleteMany({
        where: { pageId, generation, id: { lte: throughUpdateId } },
      });
      return true;
    });
  }

  async createSnapshot(options: {
    pageId: string;
    generation: number;
    document: Y.Doc;
    throughUpdateId: bigint;
    kind: "PERIODIC" | "MILESTONE";
    actorId: string | null;
    label?: string;
    activity?: SnapshotActivityMetadata;
  }) {
    const state = bytes(Y.encodeStateAsUpdate(options.document));
    const stateVector = bytes(Y.encodeStateVector(options.document));

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.documentState.findUnique({
        where: { pageId: options.pageId },
        select: { generation: true },
      });
      if (!current || current.generation !== options.generation) throw new DocumentGenerationChangedError();
      const page = await transaction.page.findUnique({
        where: { id: options.pageId },
        select: { workspaceId: true },
      });
      if (!page) throw new SnapshotNotFoundError();

      const snapshot = await transaction.documentSnapshot.create({
        data: {
          pageId: options.pageId,
          generation: options.generation,
          state,
          stateVector,
          updateId: options.throughUpdateId > 0n ? options.throughUpdateId : null,
          kind: options.kind === "PERIODIC" ? SnapshotKind.PERIODIC : SnapshotKind.MILESTONE,
          createdById: options.actorId,
          ...(options.label === undefined ? {} : { label: options.label }),
        },
      });

      if (options.kind === "MILESTONE" && options.actorId) {
        await transaction.activityLog.create({
          data: {
            workspaceId: page.workspaceId,
            pageId: options.pageId,
            actorId: options.actorId,
            action: activityActions.revisionCreated,
            entityType: "document_snapshot",
            entityId: snapshot.id,
            metadata: { label: snapshot.label, generation: snapshot.generation },
            ...(options.activity?.ipAddress === undefined ? {} : { ipAddress: options.activity.ipAddress }),
            ...(options.activity?.userAgent === undefined ? {} : { userAgent: options.activity.userAgent }),
          },
        });
      }
      return snapshot;
    });
  }

  async restoreSnapshot(options: {
    pageId: string;
    snapshotId: string;
    expectedGeneration: number;
    currentDocument: Y.Doc;
    throughUpdateId: bigint;
    actorId: string;
    label?: string;
    activity?: SnapshotActivityMetadata;
  }): Promise<RestoreResult> {
    const currentState = bytes(Y.encodeStateAsUpdate(options.currentDocument));
    const currentStateVector = bytes(Y.encodeStateVector(options.currentDocument));

    return this.prisma.$transaction(async (transaction) => {
      const activeState = await transaction.documentState.findUnique({
        where: { pageId: options.pageId },
        select: { generation: true },
      });
      if (!activeState || activeState.generation !== options.expectedGeneration) {
        throw new DocumentGenerationChangedError();
      }

      const target = await transaction.documentSnapshot.findFirst({
        where: { id: options.snapshotId, pageId: options.pageId },
      });
      if (!target) throw new SnapshotNotFoundError();
      const restoredDocument = new Y.Doc();
      Y.applyUpdate(restoredDocument, bytes(target.state), persistenceOrigin);
      const plainText = collaborativePlainText(restoredDocument);
      restoredDocument.destroy();
      const page = await transaction.page.findUnique({
        where: { id: options.pageId },
        select: { workspaceId: true },
      });
      if (!page) throw new SnapshotNotFoundError();

      const preRestore = await transaction.documentSnapshot.create({
        data: {
          pageId: options.pageId,
          generation: options.expectedGeneration,
          state: currentState,
          stateVector: currentStateVector,
          updateId: options.throughUpdateId > 0n ? options.throughUpdateId : null,
          kind: SnapshotKind.PRE_RESTORE,
          label: "Before revision restore",
          createdById: options.actorId,
        },
      });
      const generation = options.expectedGeneration + 1;
      const updated = await transaction.documentState.updateMany({
        where: { pageId: options.pageId, generation: options.expectedGeneration },
        data: {
          generation,
          state: bytes(target.state),
          stateVector: bytes(target.stateVector),
          version: { increment: 1n },
          compactedThroughUpdateId: null,
          lastCompactedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new DocumentGenerationChangedError();

      await transaction.documentSearchIndex.upsert({
        where: { pageId: options.pageId },
        create: { pageId: options.pageId, plainText },
        update: { plainText },
      });

      const restored = await transaction.documentSnapshot.create({
        data: {
          pageId: options.pageId,
          generation,
          state: bytes(target.state),
          stateVector: bytes(target.stateVector),
          kind: SnapshotKind.RESTORE,
          label: options.label ?? (target.label ? `Restored: ${target.label}` : "Restored revision"),
          createdById: options.actorId,
          restoredFromId: target.id,
        },
      });
      await transaction.activityLog.create({
        data: {
          workspaceId: page.workspaceId,
          pageId: options.pageId,
          actorId: options.actorId,
          action: activityActions.revisionRestored,
          entityType: "document_snapshot",
          entityId: restored.id,
          metadata: {
            restoredFromId: target.id,
            preRestoreSnapshotId: preRestore.id,
            previousGeneration: options.expectedGeneration,
            generation,
            label: restored.label,
          },
          ...(options.activity?.ipAddress === undefined ? {} : { ipAddress: options.activity.ipAddress }),
          ...(options.activity?.userAgent === undefined ? {} : { userAgent: options.activity.userAgent }),
        },
      });
      return { snapshotId: restored.id, preRestoreSnapshotId: preRestore.id, generation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export const yjsPersistenceOrigin = persistenceOrigin;
