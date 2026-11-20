import { createServer, type IncomingMessage, type Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { Prisma, type PrismaClient } from "@nexvia/database";
import { internalCreateSnapshotSchema, internalRestoreSnapshotSchema } from "@nexvia/shared";
import { verifyInternalRequestSignature } from "@nexvia/shared/server-crypto";
import type { Logger } from "pino";
import { WebSocketServer } from "ws";
import { SocketAuthorizationError, SocketAuthorizationService } from "./auth/socket-authorization.js";
import type { CollaborationEnv } from "./config/env.js";
import {
  DocumentGenerationChangedError,
  SnapshotNotFoundError,
  YjsPersistence,
} from "./persistence/yjs-persistence.js";
import { websocketClose } from "./protocol/constants.js";
import { RoomManager } from "./rooms/room-manager.js";
import { RedisCollaborationBus } from "./scaling/redis-collaboration-bus.js";

export interface CollaborationServer {
  httpServer: HttpServer;
  listen: () => Promise<{ host: string; port: number }>;
  close: () => Promise<void>;
}

function roomFromRequest(request: IncomingMessage): { pageId: string; generation: number } | null {
  const url = new URL(request.url ?? "/", "http://collaboration.internal");
  const match = /^\/collaboration\/([a-zA-Z0-9_-]{8,128})$/.exec(url.pathname);
  const generation = Number(url.searchParams.get("generation"));
  return match?.[1] && Number.isSafeInteger(generation) && generation > 0
    ? { pageId: decodeURIComponent(match[1]), generation }
    : null;
}

function originAllowed(request: IncomingMessage, env: CollaborationEnv): boolean {
  const origin = request.headers.origin;
  return typeof origin === "string" && env.WEB_ORIGIN.includes(origin);
}

function json(response: import("node:http").ServerResponse, statusCode: number, body: unknown): void {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.writeHead(statusCode).end(JSON.stringify(body));
}

async function requestBody(request: IncomingMessage, maxBytes = 64 * 1_024): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function internalRoute(pathname: string):
  | { action: "create"; pageId: string }
  | { action: "restore"; pageId: string; snapshotId: string }
  | null {
  const create = /^\/internal\/pages\/([a-zA-Z0-9_-]{8,128})\/snapshots$/.exec(pathname);
  if (create?.[1]) return { action: "create", pageId: create[1] };
  const restore = /^\/internal\/pages\/([a-zA-Z0-9_-]{8,128})\/snapshots\/([a-zA-Z0-9_-]{8,128})\/restore$/.exec(pathname);
  return restore?.[1] && restore[2]
    ? { action: "restore", pageId: restore[1], snapshotId: restore[2] }
    : null;
}

export function createCollaborationServer(options: {
  env: CollaborationEnv;
  prisma: PrismaClient;
  logger: Logger;
}): CollaborationServer {
  const { env, prisma, logger } = options;
  const authorization = new SocketAuthorizationService(prisma, env);
  const persistence = new YjsPersistence(prisma, env.instanceId);
  const bus = new RedisCollaborationBus(
    env.REDIS_URL,
    env.COLLABORATION_REDIS_CHANNEL_PREFIX,
    env.instanceId,
    logger,
  );
  const rooms = new RoomManager(persistence, authorization, env, logger, bus);
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: env.COLLABORATION_MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
    clientTracking: false,
  });
  let closing = false;

  const httpServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://collaboration.internal");
    const route = internalRoute(url.pathname);
    if (route) {
      if (request.method !== "POST") {
        json(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "POST required" } });
        return;
      }
      try {
        const body = await requestBody(request);
        const timestamp = request.headers["x-nexvia-timestamp"];
        const signature = request.headers["x-nexvia-signature"];
        if (
          typeof timestamp !== "string" ||
          typeof signature !== "string" ||
          !verifyInternalRequestSignature({
            secret: env.COLLABORATION_INTERNAL_SECRET,
            method: request.method,
            path: url.pathname,
            timestamp,
            body,
            signature,
          })
        ) {
          json(response, 401, { error: { code: "INVALID_INTERNAL_SIGNATURE", message: "Invalid internal signature" } });
          return;
        }
        if (closing) {
          json(response, 503, { error: { code: "SERVICE_DRAINING", message: "Collaboration service is draining" } });
          return;
        }
        const input = route.action === "create"
          ? internalCreateSnapshotSchema.parse(JSON.parse(body))
          : internalRestoreSnapshotSchema.parse(JSON.parse(body));
        if (route.action === "create") {
          const snapshot = await rooms.createSnapshot(route.pageId, input.actorId, input.label, input.activity);
          json(response, 201, {
            data: {
              snapshot: {
                id: snapshot.id,
                generation: snapshot.generation,
                kind: snapshot.kind,
                label: snapshot.label,
                createdAt: snapshot.createdAt.toISOString(),
              },
            },
          });
          return;
        }
        const result = await rooms.restoreSnapshot(
          route.pageId,
          route.snapshotId,
          input.actorId,
          input.label,
          input.activity,
        );
        json(response, 200, { data: result });
      } catch (error) {
        if (error instanceof SnapshotNotFoundError) {
          json(response, 404, { error: { code: "SNAPSHOT_NOT_FOUND", message: error.message } });
          return;
        }
        if (error instanceof DocumentGenerationChangedError) {
          json(response, 409, { error: { code: "DOCUMENT_GENERATION_CHANGED", message: error.message } });
          return;
        }
        if (error instanceof SyntaxError || (typeof error === "object" && error !== null && "issues" in error)) {
          json(response, 422, { error: { code: "VALIDATION_ERROR", message: "Invalid snapshot request" } });
          return;
        }
        if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
          json(response, 413, { error: { code: "REQUEST_TOO_LARGE", message: "Request body is too large" } });
          return;
        }
        logger.error({ error, pageId: route.pageId }, "Internal snapshot operation failed");
        json(response, 500, { error: { code: "SNAPSHOT_OPERATION_FAILED", message: "Snapshot operation failed" } });
      }
      return;
    }

    if (request.method !== "GET") {
      json(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "GET required" } });
      return;
    }
    if (request.url === "/health/live") {
      json(response, 200, { status: "ok", service: "collaboration", instanceId: env.instanceId });
      return;
    }
    if (request.url === "/health/ready") {
      try {
        await prisma.$queryRaw(Prisma.sql`SELECT 1`);
        json(response, closing ? 503 : 200, {
          status: closing ? "draining" : "ready",
          service: "collaboration",
          capabilities: {
            websocketSync: true,
            durableYjsPersistence: true,
            awareness: true,
            redisFanout: bus.isReady,
            postgresReplayRecovery: true,
          },
        });
      } catch (error) {
        logger.warn({ error }, "Collaboration readiness check failed");
        json(response, 503, { status: "not_ready", service: "collaboration", database: "down" });
      }
      return;
    }
    json(response, 404, { error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  const closeSocket = (request: IncomingMessage, socket: Duplex, head: Buffer, code: number, reason: string): void => {
    websocketServer.handleUpgrade(request, socket, head, (websocket) => websocket.close(code, reason));
  };

  httpServer.on("upgrade", (request, socket, head) => {
    const room = roomFromRequest(request);
    if (closing) {
      closeSocket(request, socket, head, websocketClose.serverRestart, "Collaboration service restarting");
      return;
    }
    if (!originAllowed(request, env)) {
      closeSocket(request, socket, head, websocketClose.forbidden, "Origin not allowed");
      return;
    }
    if (!room) {
      closeSocket(request, socket, head, websocketClose.notFound, "Collaboration room not found");
      return;
    }

    void authorization.authorizeRequest(request, room.pageId, room.generation).then((principal) => {
      if (closing || socket.destroyed) {
        if (!socket.destroyed) closeSocket(request, socket, head, websocketClose.serverRestart, "Collaboration service restarting");
        return;
      }
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        void rooms.connect(websocket, principal).catch((error: unknown) => {
          logger.error({ error, pageId: room.pageId, userId: principal.user.id }, "Failed to join collaboration room");
          websocket.close(1_011, "Could not load collaboration room");
        });
      });
    }).catch((error: unknown) => {
      if (socket.destroyed) return;
      if (error instanceof SocketAuthorizationError) {
        closeSocket(request, socket, head, error.closeCode, error.message);
        return;
      }
      logger.error({ error, pageId: room.pageId }, "WebSocket authorization failed");
      closeSocket(request, socket, head, 1_011, "Authorization unavailable");
    });
  });

  const pingTimer = setInterval(() => rooms.pingConnections(), env.COLLABORATION_PING_INTERVAL_MS);
  pingTimer.unref();
  const reconciliationTimer = setInterval(() => {
    void rooms.reconcileRooms();
  }, env.COLLABORATION_RECONCILE_INTERVAL_MS);
  reconciliationTimer.unref();

  return {
    httpServer,
    listen: async () => {
      await bus.start((event) => rooms.handleBusEvent(event));
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        httpServer.once("error", onError);
        httpServer.listen(env.COLLABORATION_PORT, env.COLLABORATION_HOST, () => {
          httpServer.off("error", onError);
          const address = httpServer.address();
          if (!address || typeof address === "string") {
            reject(new Error("Collaboration server did not bind a TCP address"));
            return;
          }
          resolve({ host: env.COLLABORATION_HOST, port: address.port });
        });
      });
    },
    close: async () => {
      if (closing) return;
      closing = true;
      clearInterval(pingTimer);
      clearInterval(reconciliationTimer);
      const httpClosed = new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeIdleConnections();
      });
      await rooms.shutdown();
      await httpClosed;
      websocketServer.close();
      await bus.close();
    },
  };
}
