import type { WebSocket } from "ws";
import type { Logger } from "pino";
import type { SocketAuthorizationService, SocketPrincipal } from "../auth/socket-authorization.js";
import type { CollaborationEnv } from "../config/env.js";
import { DocumentGenerationChangedError, type YjsPersistence } from "../persistence/yjs-persistence.js";
import type { SnapshotActivityMetadata } from "../persistence/yjs-persistence.js";
import type { CollaborationBusEvent, RedisCollaborationBus } from "../scaling/redis-collaboration-bus.js";
import { websocketClose } from "../protocol/constants.js";
import { CollaborationRoom } from "./collaboration-room.js";

export class RoomManager {
  private readonly rooms = new Map<string, Promise<CollaborationRoom>>();
  private readonly idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private shuttingDown = false;

  constructor(
    private readonly persistence: YjsPersistence,
    private readonly authorization: SocketAuthorizationService,
    private readonly env: CollaborationEnv,
    private readonly logger: Logger,
    private readonly bus: RedisCollaborationBus,
  ) {}

  async connect(socket: WebSocket, principal: SocketPrincipal): Promise<void> {
    if (this.shuttingDown) {
      socket.close(4_503, "Collaboration service restarting");
      return;
    }
    const idleTimer = this.idleTimers.get(principal.pageId);
    if (idleTimer) {
      clearTimeout(idleTimer);
      this.idleTimers.delete(principal.pageId);
    }
    const room = await this.getOrCreate(principal.pageId);
    if (room.generation !== principal.generation) {
      socket.close(websocketClose.documentRestored, "Document generation changed");
      return;
    }
    room.addConnection(socket, principal);
  }

  pingConnections(): void {
    for (const room of this.rooms.values()) void room.then((value) => value.pingConnections());
  }

  async handleBusEvent(event: CollaborationBusEvent): Promise<void> {
    const roomPromise = this.rooms.get(event.pageId);
    if (!roomPromise) return;
    const room = await roomPromise;
    if (event.type === "document-reset") {
      await this.invalidateRoom(event.pageId, websocketClose.documentRestored, "A document revision was restored");
      return;
    }
    if (event.generation !== room.generation) {
      await this.invalidateRoom(event.pageId, websocketClose.documentRestored, "Document generation changed");
      return;
    }
    if (event.type === "awareness") {
      await room.applyRemoteAwareness(event.generation, event.update);
      return;
    }
    await room.reconcile();
  }

  async reconcileRooms(): Promise<void> {
    for (const [pageId, roomPromise] of [...this.rooms]) {
      try {
        const room = await roomPromise;
        await room.reconcile();
      } catch (error) {
        if (error instanceof DocumentGenerationChangedError) {
          await this.invalidateRoom(pageId, websocketClose.documentRestored, "Document generation changed");
          continue;
        }
        this.logger.error({ error, pageId }, "Collaboration room reconciliation failed");
      }
    }
  }

  async createSnapshot(pageId: string, actorId: string, label?: string, activity?: SnapshotActivityMetadata) {
    const room = await this.getOrCreate(pageId);
    try {
      return await room.createSnapshot(actorId, label, activity);
    } finally {
      if (room.connectionCount === 0) this.scheduleIdleDisposal(room);
    }
  }

  async restoreSnapshot(
    pageId: string,
    snapshotId: string,
    actorId: string,
    label?: string,
    activity?: SnapshotActivityMetadata,
  ) {
    const room = await this.getOrCreate(pageId);
    let restored = false;
    try {
      const result = await room.restoreSnapshot(snapshotId, actorId, label, activity);
      restored = true;
      await this.bus.publishDocumentReset(pageId, result.generation);
      return result;
    } finally {
      const timer = this.idleTimers.get(pageId);
      if (timer) clearTimeout(timer);
      this.idleTimers.delete(pageId);
      this.rooms.delete(pageId);
      await room.flushAndDestroy(
        restored ? websocketClose.documentRestored : websocketClose.serverRestart,
        restored ? "A document revision was restored" : "Collaboration room reloading",
        false,
      );
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const timer of this.idleTimers.values()) clearTimeout(timer);
    this.idleTimers.clear();
    const rooms = await Promise.all(this.rooms.values());
    await Promise.all(rooms.map((room) => room.flushAndDestroy()));
    this.rooms.clear();
  }

  private getOrCreate(pageId: string): Promise<CollaborationRoom> {
    const existing = this.rooms.get(pageId);
    if (existing) return existing;

    const roomPromise = this.persistence.loadDocument(pageId).then((loaded) => new CollaborationRoom({
      pageId,
      document: loaded.document,
      generation: loaded.generation,
      lastUpdateId: loaded.lastUpdateId,
      persistence: this.persistence,
      authorization: this.authorization,
      logger: this.logger,
      compactEveryUpdates: this.env.COLLABORATION_COMPACT_EVERY_UPDATES,
      snapshotEveryUpdates: this.env.COLLABORATION_SNAPSHOT_EVERY_UPDATES,
      bus: this.bus,
      onEmpty: (room) => this.scheduleIdleDisposal(room),
    })).catch((error: unknown) => {
      this.rooms.delete(pageId);
      throw error;
    });
    this.rooms.set(pageId, roomPromise);
    return roomPromise;
  }

  private scheduleIdleDisposal(room: CollaborationRoom): void {
    if (this.shuttingDown || this.idleTimers.has(room.pageId)) return;
    const timer = setTimeout(() => {
      this.idleTimers.delete(room.pageId);
      if (room.connectionCount !== 0 || this.rooms.get(room.pageId) === undefined) return;
      this.rooms.delete(room.pageId);
      void room.flushAndDestroy(1_000).catch((error: unknown) => {
        this.logger.error({ error, pageId: room.pageId }, "Failed to dispose idle collaboration room");
      });
    }, this.env.COLLABORATION_ROOM_IDLE_MS);
    timer.unref();
    this.idleTimers.set(room.pageId, timer);
  }

  private async invalidateRoom(pageId: string, closeCode: number, reason: string): Promise<void> {
    const timer = this.idleTimers.get(pageId);
    if (timer) clearTimeout(timer);
    this.idleTimers.delete(pageId);
    const roomPromise = this.rooms.get(pageId);
    if (!roomPromise) return;
    this.rooms.delete(pageId);
    const room = await roomPromise;
    await room.flushAndDestroy(closeCode, reason, false);
  }
}
