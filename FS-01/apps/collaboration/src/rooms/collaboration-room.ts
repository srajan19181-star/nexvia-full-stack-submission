import type { RawData, WebSocket } from "ws";
import { WebSocket as WebSocketState } from "ws";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import type { Logger } from "pino";
import { DocumentGenerationChangedError } from "../persistence/yjs-persistence.js";
import {
  SocketAuthorizationError,
  type SocketAuthorizationService,
  type SocketPrincipal,
} from "../auth/socket-authorization.js";
import type { YjsPersistence } from "../persistence/yjs-persistence.js";
import type { SnapshotActivityMetadata } from "../persistence/yjs-persistence.js";
import type { RedisCollaborationBus } from "../scaling/redis-collaboration-bus.js";
import { websocketClose, websocketMessage } from "../protocol/constants.js";

interface RoomConnection {
  socket: WebSocket;
  principal: SocketPrincipal;
  awarenessClientIds: Set<number>;
  alive: boolean;
}

interface CollaborationRoomOptions {
  pageId: string;
  document: Y.Doc;
  generation: number;
  lastUpdateId: bigint;
  persistence: YjsPersistence;
  authorization: SocketAuthorizationService;
  logger: Logger;
  compactEveryUpdates: number;
  snapshotEveryUpdates: number;
  bus: RedisCollaborationBus;
  onEmpty: (room: CollaborationRoom) => void;
}

function binaryData(data: RawData): Uint8Array<ArrayBuffer> {
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : Buffer.from(data);
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy;
}

function send(socket: WebSocket, message: Uint8Array): void {
  if (socket.readyState === WebSocketState.OPEN) {
    socket.send(message, { binary: true });
  }
}

function encodeSyncStep1(document: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, websocketMessage.sync);
  syncProtocol.writeSyncStep1(encoder, document);
  return encoding.toUint8Array(encoder);
}

function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, websocketMessage.sync);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function encodeSyncStep2(document: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, websocketMessage.sync);
  syncProtocol.writeSyncStep2(encoder, document);
  return encoding.toUint8Array(encoder);
}

function encodeAwareness(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, websocketMessage.awareness);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

interface AwarenessEntry {
  clientId: number;
  clock: number;
  state: unknown;
}

function awarenessEntries(update: Uint8Array): AwarenessEntry[] {
  const decoder = decoding.createDecoder(update);
  const length = decoding.readVarUint(decoder);
  const entries: AwarenessEntry[] = [];
  for (let index = 0; index < length; index += 1) {
    const clientId = decoding.readVarUint(decoder);
    const clock = decoding.readVarUint(decoder);
    entries.push({ clientId, clock, state: JSON.parse(decoding.readVarString(decoder)) as unknown });
  }
  if (decoding.hasContent(decoder)) throw new Error("Unexpected awareness payload data");
  return entries;
}

function sanitizedAwarenessUpdate(entries: AwarenessEntry[], principal: SocketPrincipal): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, entries.length);
  for (const entry of entries) {
    encoding.writeVarUint(encoder, entry.clientId);
    encoding.writeVarUint(encoder, entry.clock);
    encoding.writeVarString(encoder, JSON.stringify(safeAwarenessState(entry.state, principal)));
  }
  return encoding.toUint8Array(encoder);
}

function cursorColor(userId: string): string {
  const palette = ["#7057d9", "#0f8b8d", "#d05a44", "#2374ab", "#b76d00", "#9b4d96", "#24824a", "#c33c67"];
  let hash = 0;
  for (const character of userId) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return palette[hash % palette.length]!;
}

function safeAwarenessState(state: unknown, principal: SocketPrincipal): Record<string, unknown> | null {
  if (state === null) return null;
  const candidate = typeof state === "object" && state !== null ? state as Record<string, unknown> : {};
  return {
    ...(candidate.cursor === undefined ? {} : { cursor: candidate.cursor }),
    user: {
      id: principal.user.id,
      name: principal.user.name,
      avatarUrl: principal.user.avatarUrl,
      color: cursorColor(principal.user.id),
    },
    permission: principal.permissions.edit ? "editor" : principal.permissions.comment ? "commenter" : "viewer",
  };
}

export class CollaborationRoom {
  readonly pageId: string;
  readonly document: Y.Doc;
  private readonly awareness: awarenessProtocol.Awareness;
  private readonly connections = new Set<RoomConnection>();
  private operationQueue: Promise<void> = Promise.resolve();
  private lastUpdateId: bigint;
  private updatesSinceCompaction = 0;
  private updatesSinceSnapshot = 0;
  private readonly remoteAwarenessClientIds = new Set<number>();
  private destroyed = false;
  private sealed = false;

  constructor(private readonly options: CollaborationRoomOptions) {
    this.pageId = options.pageId;
    this.document = options.document;
    this.lastUpdateId = options.lastUpdateId;
    this.awareness = new awarenessProtocol.Awareness(this.document);
    this.awareness.setLocalState(null);
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  get generation(): number {
    return this.options.generation;
  }

  addConnection(socket: WebSocket, principal: SocketPrincipal): void {
    if (this.destroyed || this.sealed) {
      socket.close(
        this.sealed ? websocketClose.documentRestored : websocketClose.serverRestart,
        this.sealed ? "A document revision was restored" : "Room is restarting",
      );
      return;
    }

    const connection: RoomConnection = {
      socket,
      principal,
      awarenessClientIds: new Set(),
      alive: true,
    };
    this.connections.add(connection);
    this.options.logger.debug({ pageId: this.pageId, userId: principal.user.id }, "Collaboration connection joined room");

    socket.on("message", (data, isBinary) => {
      if (this.sealed) {
        socket.close(websocketClose.documentRestored, "A document revision was restored");
        return;
      }
      if (!isBinary) {
        socket.close(1_003, "Binary messages required");
        return;
      }
      const message = binaryData(data);
      void this.runExclusive(async () => this.receive(connection, message));
    });
    socket.on("pong", () => {
      connection.alive = true;
    });
    socket.once("close", () => this.removeConnection(connection));
    socket.on("error", (error) => {
      this.options.logger.debug({ error, pageId: this.pageId, userId: principal.user.id }, "Collaboration socket error");
    });

    send(socket, encodeSyncStep1(this.document));
    const awarenessIds = [...this.awareness.getStates().keys()];
    if (awarenessIds.length > 0) {
      send(socket, encodeAwareness(awarenessProtocol.encodeAwarenessUpdate(this.awareness, awarenessIds)));
    }
  }

  pingConnections(): void {
    for (const connection of this.connections) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }

  async reconcile(): Promise<void> {
    await this.runExclusive(async () => {
      await this.applyDurableReplay();
      this.removeStaleRemoteAwareness();
    });
  }

  async applyRemoteAwareness(generation: number, encodedUpdate: string): Promise<void> {
    if (generation !== this.options.generation || this.destroyed || this.sealed) return;
    const update = new Uint8Array(Buffer.from(encodedUpdate, "base64url"));
    await this.runExclusive(async () => {
      const acceptedEntries = awarenessEntries(update).filter((entry) => {
        const locallyOwned = [...this.connections].some((connection) => connection.awarenessClientIds.has(entry.clientId));
        if (locallyOwned) return false;
        if (entry.state === null) this.remoteAwarenessClientIds.delete(entry.clientId);
        else this.remoteAwarenessClientIds.add(entry.clientId);
        return true;
      });
      if (acceptedEntries.length === 0) return;
      const acceptedUpdate = encodeAwarenessEntries(acceptedEntries);
      awarenessProtocol.applyAwarenessUpdate(this.awareness, acceptedUpdate, this.options.bus);
      this.broadcast(encodeAwareness(acceptedUpdate));
    });
  }

  async createSnapshot(actorId: string, label?: string, activity?: SnapshotActivityMetadata) {
    return this.runExclusive(() => this.options.persistence.createSnapshot({
      pageId: this.pageId,
      generation: this.options.generation,
      document: this.document,
      throughUpdateId: this.lastUpdateId,
      kind: "MILESTONE",
      actorId,
      ...(label === undefined ? {} : { label }),
      ...(activity === undefined ? {} : { activity }),
    }));
  }

  async restoreSnapshot(snapshotId: string, actorId: string, label?: string, activity?: SnapshotActivityMetadata) {
    if (this.sealed || this.destroyed) throw new Error("The collaboration room is already resetting");
    this.sealed = true;
    return this.runExclusive(() => this.options.persistence.restoreSnapshot({
      pageId: this.pageId,
      snapshotId,
      expectedGeneration: this.options.generation,
      currentDocument: this.document,
      throughUpdateId: this.lastUpdateId,
      actorId,
      ...(label === undefined ? {} : { label }),
      ...(activity === undefined ? {} : { activity }),
    }));
  }

  async flushAndDestroy(
    closeCode: number = websocketClose.serverRestart,
    reason = "Collaboration service restarting",
    compact = true,
  ): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const connection of this.connections) {
      connection.socket.close(closeCode, reason);
    }
    await this.operationQueue;
    if (compact) await this.compact();
    this.awareness.destroy();
    this.document.destroy();
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => undefined, (error: unknown) => {
      this.options.logger.error({ error, pageId: this.pageId }, "Collaboration room operation failed");
    });
    return result;
  }

  private async receive(connection: RoomConnection, message: Uint8Array): Promise<void> {
    try {
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      this.options.logger.trace({ pageId: this.pageId, userId: connection.principal.user.id, messageType }, "Collaboration message received");

      if (messageType === websocketMessage.sync) {
        await this.receiveSync(connection, decoder);
      } else if (messageType === websocketMessage.awareness) {
        await this.receiveAwareness(connection, decoder);
      } else if (messageType === websocketMessage.queryAwareness) {
        this.sendAwarenessSnapshot(connection.socket);
      } else {
        connection.socket.close(websocketClose.invalidMessage, "Unsupported collaboration message");
      }
    } catch (error) {
      if (error instanceof SocketAuthorizationError) {
        connection.socket.close(error.closeCode, error.message);
        return;
      }
      this.options.logger.warn({ error, pageId: this.pageId, userId: connection.principal.user.id }, "Invalid collaboration message");
      connection.socket.close(websocketClose.invalidMessage, "Invalid collaboration message");
    }
  }

  private async receiveSync(connection: RoomConnection, decoder: decoding.Decoder): Promise<void> {
    const syncType = decoding.readVarUint(decoder);
    this.options.logger.trace({ pageId: this.pageId, userId: connection.principal.user.id, syncType }, "Yjs sync message received");
    if (syncType === syncProtocol.messageYjsSyncStep1) {
      const stateVector = decoding.readVarUint8Array(decoder);
      if (decoding.hasContent(decoder)) throw new Error("Unexpected sync step 1 data");
      const response = encoding.createEncoder();
      encoding.writeVarUint(response, websocketMessage.sync);
      syncProtocol.writeSyncStep2(response, this.document, stateVector);
      send(connection.socket, encoding.toUint8Array(response));
      this.options.logger.trace({ pageId: this.pageId, userId: connection.principal.user.id }, "Yjs sync step 2 sent");
      return;
    }

    if (syncType !== syncProtocol.messageYjsSyncStep2 && syncType !== syncProtocol.messageYjsUpdate) {
      throw new Error("Unknown Yjs sync message");
    }

    const update = decoding.readVarUint8Array(decoder);
    if (decoding.hasContent(decoder)) throw new Error("Unexpected sync update data");
    connection.principal = await this.options.authorization.refresh(connection.principal);

    if (!connection.principal.permissions.edit) {
      if (syncType === syncProtocol.messageYjsUpdate) {
        throw new SocketAuthorizationError("Editor permission required", websocketClose.forbidden);
      }
      send(connection.socket, encodeSyncStep2(this.document));
      return;
    }

    Y.decodeUpdate(update);
    const persisted = await this.options.persistence.appendUpdate(
      this.pageId,
      this.options.generation,
      update,
      connection.principal.user.id,
    );
    await this.applyDurableReplay();
    if (!persisted.deduplicated) this.updatesSinceCompaction += 1;
    if (!persisted.deduplicated) this.updatesSinceSnapshot += 1;
    this.broadcast(encodeSyncUpdate(update));
    await this.options.bus.publishDocumentUpdate(this.pageId, this.options.generation, persisted.id).catch((error: unknown) => {
      this.options.logger.warn({ error, pageId: this.pageId }, "Could not publish document update; reconciliation will recover it");
    });

    if (syncType === syncProtocol.messageYjsSyncStep2) {
      send(connection.socket, encodeSyncStep2(this.document));
    }

    if (this.updatesSinceCompaction >= this.options.compactEveryUpdates) {
      await this.compact();
    }
    if (this.updatesSinceSnapshot >= this.options.snapshotEveryUpdates) {
      await this.options.persistence.createSnapshot({
        pageId: this.pageId,
        generation: this.options.generation,
        document: this.document,
        throughUpdateId: this.lastUpdateId,
        kind: "PERIODIC",
        actorId: connection.principal.user.id,
      });
      this.updatesSinceSnapshot = 0;
    }
  }

  private async receiveAwareness(connection: RoomConnection, decoder: decoding.Decoder): Promise<void> {
    const update = decoding.readVarUint8Array(decoder);
    if (decoding.hasContent(decoder)) throw new Error("Unexpected awareness data");

    const acceptedEntries: AwarenessEntry[] = [];
    for (const entry of awarenessEntries(update)) {
      if (entry.clientId === this.awareness.clientID) continue;
      const ownedByConnection = connection.awarenessClientIds.has(entry.clientId);
      const ownedByAnotherConnection = [...this.connections].some(
        (candidate) => candidate !== connection && candidate.awarenessClientIds.has(entry.clientId),
      );
      if (ownedByAnotherConnection) continue;
      if (ownedByConnection) {
        acceptedEntries.push(entry);
        continue;
      }
      if (entry.state !== null && connection.awarenessClientIds.size === 0) {
        connection.awarenessClientIds.add(entry.clientId);
        acceptedEntries.push(entry);
      }
    }
    if (acceptedEntries.length === 0) return;

    const sanitized = sanitizedAwarenessUpdate(acceptedEntries, connection.principal);
    awarenessProtocol.applyAwarenessUpdate(this.awareness, sanitized, connection);
    this.broadcast(encodeAwareness(sanitized));
    await this.options.bus.publishAwareness(this.pageId, this.options.generation, sanitized).catch((error: unknown) => {
      this.options.logger.warn({ error, pageId: this.pageId }, "Could not publish awareness update");
    });
  }

  private sendAwarenessSnapshot(socket: WebSocket): void {
    const awarenessIds = [...this.awareness.getStates().keys()];
    if (awarenessIds.length > 0) {
      send(socket, encodeAwareness(awarenessProtocol.encodeAwarenessUpdate(this.awareness, awarenessIds)));
    }
  }

  private broadcast(message: Uint8Array): void {
    for (const connection of this.connections) send(connection.socket, message);
  }

  private removeConnection(connection: RoomConnection): void {
    if (!this.connections.delete(connection)) return;
    this.options.logger.debug({ pageId: this.pageId, userId: connection.principal.user.id }, "Collaboration connection left room");
    const clientIds = [...connection.awarenessClientIds];
    if (clientIds.length > 0) {
      awarenessProtocol.removeAwarenessStates(this.awareness, clientIds, connection);
      const removableClientIds = clientIds.filter((clientId) => this.awareness.meta.has(clientId));
      if (removableClientIds.length > 0) {
        const removalUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, removableClientIds);
        this.broadcast(encodeAwareness(removalUpdate));
        void this.options.bus.publishAwareness(this.pageId, this.options.generation, removalUpdate).catch((error: unknown) => {
          this.options.logger.warn({ error, pageId: this.pageId }, "Could not publish awareness removal");
        });
      }
    }
    if (this.connections.size === 0) this.options.onEmpty(this);
  }

  private async compact(): Promise<void> {
    if (this.lastUpdateId <= 0n) return;
    const compacted = await this.options.persistence.compact(
      this.pageId,
      this.options.generation,
      this.document,
      this.lastUpdateId,
    );
    if (compacted) this.updatesSinceCompaction = 0;
  }

  private async applyDurableReplay(): Promise<void> {
    const replay = await this.options.persistence.replayAfter(
      this.pageId,
      this.options.generation,
      this.lastUpdateId,
    );
    if (replay.generation !== this.options.generation) throw new DocumentGenerationChangedError();
    if (replay.compactedState && replay.compactedThroughUpdateId !== null) {
      Y.applyUpdate(this.document, replay.compactedState, this.options.bus);
      this.lastUpdateId = replay.compactedThroughUpdateId;
      this.broadcast(encodeSyncUpdate(replay.compactedState));
    }
    for (const durableUpdate of replay.updates) {
      if (durableUpdate.id <= this.lastUpdateId) continue;
      Y.applyUpdate(this.document, durableUpdate.update, this.options.bus);
      this.lastUpdateId = durableUpdate.id;
      this.broadcast(encodeSyncUpdate(durableUpdate.update));
    }
  }

  private removeStaleRemoteAwareness(): void {
    const staleBefore = Date.now() - 35_000;
    const staleClientIds = [...this.remoteAwarenessClientIds].filter((clientId) => {
      const metadata = this.awareness.meta.get(clientId);
      return !metadata || metadata.lastUpdated < staleBefore;
    });
    if (staleClientIds.length === 0) return;
    for (const clientId of staleClientIds) this.remoteAwarenessClientIds.delete(clientId);
    awarenessProtocol.removeAwarenessStates(this.awareness, staleClientIds, this.options.bus);
    const removableClientIds = staleClientIds.filter((clientId) => this.awareness.meta.has(clientId));
    if (removableClientIds.length > 0) {
      this.broadcast(encodeAwareness(awarenessProtocol.encodeAwarenessUpdate(this.awareness, removableClientIds)));
    }
  }
}

function encodeAwarenessEntries(entries: AwarenessEntry[]): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, entries.length);
  for (const entry of entries) {
    encoding.writeVarUint(encoder, entry.clientId);
    encoding.writeVarUint(encoder, entry.clock);
    encoding.writeVarString(encoder, JSON.stringify(entry.state));
  }
  return encoding.toUint8Array(encoder);
}
