import { createDatabaseClient, type PrismaClient } from "@nexvia/database";
import { hashKeyedToken } from "@nexvia/shared/server-crypto";
import { createInternalRequestSignature } from "@nexvia/shared/server-crypto";
import pino from "pino";
import { WebSocket as NodeWebSocket } from "ws";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCollaborationEnv, type CollaborationEnv } from "../src/config/env.js";
import { createCollaborationServer, type CollaborationServer } from "../src/server.js";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://nexvia:nexvia_dev_password@localhost:5432/nexvia_test?schema=public";
const sessionSecret = "collaboration-test-session-secret-at-least-thirty-two-characters";
const allowedOrigin = "http://localhost:5173";
const internalSecret = "collaboration-internal-test-secret-at-least-thirty-two-characters";

function websocketClass(token: string | null, origin = allowedOrigin): typeof globalThis.WebSocket {
  class AuthenticatedWebSocket extends NodeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols, {
        origin,
        ...(token ? { headers: { Cookie: `nexvia_session=${encodeURIComponent(token)}` } } : {}),
      });
    }
  }
  return AuthenticatedWebSocket as unknown as typeof globalThis.WebSocket;
}

function provider(serverUrl: string, pageId: string, document: Y.Doc, token: string, generation = 1): WebsocketProvider {
  return new WebsocketProvider(serverUrl, pageId, document, {
    WebSocketPolyfill: websocketClass(token),
    disableBc: true,
    maxBackoffTime: 100,
    params: { generation: generation.toString() },
  });
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function waitForSync(value: WebsocketProvider): Promise<void> {
  await waitFor(() => value.synced, "provider synchronization");
}

describe("authenticated collaboration WebSocket", () => {
  let prisma: PrismaClient;
  let env: CollaborationEnv;
  let server: CollaborationServer;
  let serverUrl: string;
  let workspaceId: string;
  let pageId: string;
  let ownerId: string;
  let viewerId: string;
  const ownerToken = `owner-${Date.now()}-session-token`;
  const viewerToken = `viewer-${Date.now()}-session-token`;
  const documents: Y.Doc[] = [];
  const providers: WebsocketProvider[] = [];
  let activeGeneration = 1;
  let restoredContent: string | null = null;

  async function startServer(): Promise<void> {
    server = createCollaborationServer({
      env,
      prisma,
      logger: pino({ level: process.env.DEBUG_COLLAB_TEST === "true" ? "debug" : "silent" }),
    });
    const address = await server.listen();
    serverUrl = `ws://127.0.0.1:${address.port}/collaboration`;
  }

  beforeAll(async () => {
    prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 4 });
    env = parseCollaborationEnv({
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: testDatabaseUrl,
      REDIS_URL: "redis://localhost:6379",
      WEB_ORIGIN: allowedOrigin,
      SESSION_COOKIE_NAME: "nexvia_session",
      SESSION_SECRET: sessionSecret,
      COLLABORATION_HOST: "127.0.0.1",
      COLLABORATION_PORT: "0",
      COLLABORATION_INSTANCE_ID: "websocket-integration-test",
      COLLABORATION_ROOM_IDLE_MS: "1000",
      COLLABORATION_COMPACT_EVERY_UPDATES: "100",
      COLLABORATION_PING_INTERVAL_MS: "2000",
      COLLABORATION_RECONCILE_INTERVAL_MS: "250",
      COLLABORATION_REDIS_CHANNEL_PREFIX: `nexvia:collaboration-test:${Date.now()}`,
      COLLABORATION_INTERNAL_SECRET: internalSecret,
    });

    const owner = await prisma.user.create({
      data: {
        email: `collab-owner-${Date.now()}@example.test`,
        name: "Collaboration Owner",
        passwordHash: "integration-test-only",
      },
    });
    ownerId = owner.id;
    const viewer = await prisma.user.create({
      data: {
        email: `collab-viewer-${Date.now()}@example.test`,
        name: "Read Only Viewer",
        passwordHash: "integration-test-only",
      },
    });
    viewerId = viewer.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: "WebSocket Integration Workspace",
        slug: `websocket-${Date.now()}`,
        createdById: owner.id,
        members: {
          create: [
            { userId: owner.id, workspaceRole: "OWNER", contentRole: "EDITOR" },
            { userId: viewer.id, workspaceRole: "MEMBER", contentRole: "VIEWER" },
          ],
        },
      },
    });
    workspaceId = workspace.id;
    const page = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Live collaboration",
        createdById: owner.id,
        updatedById: owner.id,
      },
    });
    pageId = page.id;
    await prisma.session.createMany({
      data: [
        {
          userId: owner.id,
          tokenHash: hashKeyedToken(ownerToken, sessionSecret),
          expiresAt: new Date(Date.now() + 60 * 60_000),
        },
        {
          userId: viewer.id,
          tokenHash: hashKeyedToken(viewerToken, sessionSecret),
          expiresAt: new Date(Date.now() + 60 * 60_000),
        },
      ],
    });
    await startServer();
  });

  afterAll(async () => {
    for (const value of providers) value.destroy();
    for (const document of documents) document.destroy();
    await server.close();
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
    await prisma.$disconnect();
  });

  it("rejects missing cookies and untrusted origins with permanent close codes", async () => {
    const missingCookie = new NodeWebSocket(`${serverUrl}/${pageId}?generation=1`, { origin: allowedOrigin });
    const missingCookieCode = await new Promise<number>((resolve) => missingCookie.once("close", resolve));
    expect(missingCookieCode).toBe(4_401);

    const BadOriginSocket = websocketClass(ownerToken, "http://attacker.example");
    const badOrigin = new BadOriginSocket(`${serverUrl}/${pageId}`);
    const badOriginCode = await new Promise<number>((resolve) => badOrigin.addEventListener("close", (event) => resolve(event.code), { once: true }));
    expect(badOriginCode).toBe(4_403);
  });

  it("converges simultaneous edits and attributes durable updates", async () => {
    const firstDocument = new Y.Doc();
    const secondDocument = new Y.Doc();
    documents.push(firstDocument, secondDocument);
    const firstProvider = provider(serverUrl, pageId, firstDocument, ownerToken);
    const secondProvider = provider(serverUrl, pageId, secondDocument, ownerToken);
    providers.push(firstProvider, secondProvider);
    await Promise.all([waitForSync(firstProvider), waitForSync(secondProvider)]);

    firstDocument.getText("body").insert(0, "Alpha");
    secondDocument.getText("body").insert(0, "Beta");

    await waitFor(
      () => firstDocument.getText("body").toString() === secondDocument.getText("body").toString()
        && firstDocument.getText("body").length === 9,
      "concurrent Yjs convergence",
    );
    const content = firstDocument.getText("body").toString();
    expect(content).toContain("Alpha");
    expect(content).toContain("Beta");
    await waitFor(async () => (await prisma.documentUpdate.count({ where: { pageId, actorId: ownerId } })) >= 2, "durable updates");
  });

  it("sanitizes presence identity and removes stale awareness on disconnect", async () => {
    const firstProvider = providers[0]!;
    const secondProvider = providers[1]!;
    const secondClientId = documents[1]!.clientID;
    firstProvider.awareness.setLocalState({ user: { id: "spoofed", name: "Spoofed Owner", color: "#000000" } });
    secondProvider.awareness.setLocalState({ user: { id: "spoofed", name: "Spoofed Peer", color: "#000000" } });

    await waitFor(() => {
      const remote = secondProvider.awareness.getStates().get(documents[0]!.clientID)?.user as Record<string, unknown> | undefined;
      return remote?.id === ownerId && remote.name === "Collaboration Owner" && remote.color !== "#000000";
    }, "authenticated presence identity");

    secondProvider.disconnect();
    await waitFor(() => !firstProvider.awareness.getStates().has(secondClientId), "stale presence cleanup");
    secondProvider.connect();
    await waitForSync(secondProvider);
  });

  it("converges documents and presence across Redis-connected collaboration instances", async () => {
    const multiInstancePage = await prisma.page.create({
      data: {
        workspaceId,
        title: "Multi-instance collaboration",
        createdById: ownerId,
        updatedById: ownerId,
      },
    });
    const secondServer = createCollaborationServer({
      env: parseCollaborationEnv({
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        DATABASE_URL: testDatabaseUrl,
        REDIS_URL: "redis://localhost:6379",
        WEB_ORIGIN: allowedOrigin,
        SESSION_COOKIE_NAME: "nexvia_session",
        SESSION_SECRET: sessionSecret,
        TRUST_PROXY: "false",
        COLLABORATION_HOST: "127.0.0.1",
        COLLABORATION_PORT: "0",
        COLLABORATION_INSTANCE_ID: "websocket-integration-test-secondary",
        COLLABORATION_ROOM_IDLE_MS: "1000",
        COLLABORATION_COMPACT_EVERY_UPDATES: "100",
        COLLABORATION_PING_INTERVAL_MS: "2000",
        COLLABORATION_RECONCILE_INTERVAL_MS: "250",
        COLLABORATION_REDIS_CHANNEL_PREFIX: env.COLLABORATION_REDIS_CHANNEL_PREFIX,
        COLLABORATION_INTERNAL_SECRET: internalSecret,
      }),
      prisma,
      logger: pino({ level: "silent" }),
    });
    const secondAddress = await secondServer.listen();
    const secondServerUrl = `ws://127.0.0.1:${secondAddress.port}/collaboration`;
    const firstDocument = new Y.Doc();
    const secondDocument = new Y.Doc();
    const firstProvider = provider(serverUrl, multiInstancePage.id, firstDocument, ownerToken);
    const secondProvider = provider(secondServerUrl, multiInstancePage.id, secondDocument, ownerToken);

    try {
      await Promise.all([waitForSync(firstProvider), waitForSync(secondProvider)]);
      firstDocument.getText("body").insert(0, "Instance A");
      secondDocument.getText("body").insert(0, "Instance B");

      await waitFor(
        () => firstDocument.getText("body").toString() === secondDocument.getText("body").toString()
          && firstDocument.getText("body").toString().includes("Instance A")
          && firstDocument.getText("body").toString().includes("Instance B"),
        "cross-instance document convergence",
      );

      firstProvider.awareness.setLocalState({ cursor: { anchor: 0, head: 0 } });
      secondProvider.awareness.setLocalState({ cursor: { anchor: 1, head: 1 } });
      await waitFor(
        () => firstProvider.awareness.getStates().has(secondDocument.clientID)
          && secondProvider.awareness.getStates().has(firstDocument.clientID),
        "cross-instance awareness convergence",
      );

      secondProvider.disconnect();
      await waitFor(
        () => !firstProvider.awareness.getStates().has(secondDocument.clientID),
        "cross-instance stale awareness cleanup",
      );
      expect(await prisma.documentUpdate.count({ where: { pageId: multiInstancePage.id } })).toBeGreaterThanOrEqual(2);
    } finally {
      firstProvider.destroy();
      secondProvider.destroy();
      firstDocument.destroy();
      secondDocument.destroy();
      await secondServer.close();
      await prisma.page.delete({ where: { id: multiInstancePage.id } });
    }
  });

  it("replays offline edits after reconnect without losing concurrent work", async () => {
    const onlineDocument = documents[0]!;
    const offlineDocument = documents[1]!;
    const onlineProvider = providers[0]!;
    const offlineProvider = providers[1]!;
    offlineProvider.disconnect();
    await waitFor(() => !offlineProvider.wsconnected, "provider disconnection");

    offlineDocument.getText("body").insert(offlineDocument.getText("body").length, " Offline");
    onlineDocument.getText("body").insert(onlineDocument.getText("body").length, " Online");
    offlineProvider.connect();
    await waitForSync(offlineProvider);

    await waitFor(
      () => onlineDocument.getText("body").toString() === offlineDocument.getText("body").toString()
        && onlineDocument.getText("body").toString().includes("Offline")
        && onlineDocument.getText("body").toString().includes("Online"),
      "reconnect convergence",
    );
  });

  it("rechecks permissions before every mutation on an open socket", async () => {
    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: viewerId } },
      data: { contentRole: "EDITOR" },
    });
    const downgradedDocument = new Y.Doc();
    documents.push(downgradedDocument);
    const downgradedProvider = provider(serverUrl, pageId, downgradedDocument, viewerToken);
    providers.push(downgradedProvider);
    await waitForSync(downgradedProvider);
    downgradedDocument.getText("body").insert(0, "PERMITTED-");
    await waitFor(() => documents[0]!.getText("body").toString().includes("PERMITTED-"), "permitted editor update");

    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: viewerId } },
      data: { contentRole: "VIEWER" },
    });
    const updateCount = await prisma.documentUpdate.count({ where: { pageId } });
    const closed = new Promise<number>((resolve) => {
      downgradedProvider.on("closed", (event: { code: number }) => resolve(event.code));
    });
    downgradedDocument.getText("body").insert(0, "DENIED-AFTER-DOWNGRADE-");

    expect(await closed).toBe(4_403);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await prisma.documentUpdate.count({ where: { pageId } })).toBe(updateCount);
    expect(documents[0]!.getText("body").toString()).not.toContain("DENIED-AFTER-DOWNGRADE-");
  });

  it("closes a viewer that sends a document update and never persists it", async () => {
    const viewerDocument = new Y.Doc();
    documents.push(viewerDocument);
    const viewerProvider = provider(serverUrl, pageId, viewerDocument, viewerToken);
    providers.push(viewerProvider);
    await waitForSync(viewerProvider);
    const updateCount = await prisma.documentUpdate.count({ where: { pageId } });
    const closed = new Promise<number>((resolve) => {
      viewerProvider.on("closed", (event: { code: number }) => resolve(event.code));
    });

    viewerDocument.getText("body").insert(0, "UNAUTHORIZED-");
    expect(await closed).toBe(4_403);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await prisma.documentUpdate.count({ where: { pageId } })).toBe(updateCount);
    expect(documents[0]!.getText("body").toString()).not.toContain("UNAUTHORIZED-");
  });

  it("restores an immutable snapshot and resets every active document generation", async () => {
    const baseUrl = serverUrl.replace(/^ws:/, "http:").replace(/\/collaboration$/, "");
    const postInternal = async (path: string, payload: unknown) => {
      const body = JSON.stringify(payload);
      const timestamp = Date.now().toString();
      return fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nexvia-timestamp": timestamp,
          "x-nexvia-signature": createInternalRequestSignature(internalSecret, "POST", path, timestamp, body),
        },
        body,
      });
    };

    const milestoneResponse = await postInternal(`/internal/pages/${pageId}/snapshots`, {
      actorId: ownerId,
      label: "Before launch review",
    });
    expect(milestoneResponse.status).toBe(201);
    const milestone = await milestoneResponse.json() as { data: { snapshot: { id: string } } };
    const milestoneContent = documents[0]!.getText("body").toString();

    documents[0]!.getText("body").insert(documents[0]!.getText("body").length, " POST-SNAPSHOT");
    await waitFor(
      () => documents[1]!.getText("body").toString().includes("POST-SNAPSHOT"),
      "post-snapshot update convergence",
    );

    const activeProviders = providers.slice(0, 2);
    const closed = activeProviders.map((value) => new Promise<number>((resolve) => {
      value.on("closed", (event: { code: number }) => resolve(event.code));
    }));
    const restoreResponse = await postInternal(
      `/internal/pages/${pageId}/snapshots/${milestone.data.snapshot.id}/restore`,
      { actorId: ownerId, label: "Return to review baseline" },
    );
    expect(restoreResponse.status).toBe(200);
    const restore = await restoreResponse.json() as { data: { generation: number } };
    activeGeneration = restore.data.generation;
    expect(activeGeneration).toBe(2);
    expect(await Promise.all(closed)).toEqual([4_409, 4_409]);

    const state = await prisma.documentState.findUniqueOrThrow({ where: { pageId } });
    expect(state.generation).toBe(2);
    const snapshots = await prisma.documentSnapshot.findMany({ where: { pageId } });
    expect(snapshots.map((snapshot) => snapshot.kind)).toEqual(
      expect.arrayContaining(["MILESTONE", "PRE_RESTORE", "RESTORE"]),
    );
    const preRestore = snapshots.find((snapshot) => snapshot.kind === "PRE_RESTORE")!;
    const previousDocument = new Y.Doc();
    Y.applyUpdate(previousDocument, preRestore.state);
    expect(previousDocument.getText("body").toString()).toContain("POST-SNAPSHOT");
    previousDocument.destroy();

    const staleDocument = new Y.Doc();
    documents.push(staleDocument);
    const staleProvider = provider(serverUrl, pageId, staleDocument, ownerToken, 1);
    providers.push(staleProvider);
    const staleClose = new Promise<number>((resolve) => {
      staleProvider.on("closed", (event: { code: number }) => resolve(event.code));
    });
    expect(await staleClose).toBe(4_409);

    const restoredDocument = new Y.Doc();
    documents.push(restoredDocument);
    const restoredProvider = provider(serverUrl, pageId, restoredDocument, ownerToken, activeGeneration);
    providers.push(restoredProvider);
    await waitForSync(restoredProvider);
    await waitFor(() => restoredDocument.getText("body").toString() === milestoneContent, "restored revision content");
    restoredContent = restoredDocument.getText("body").toString();
    expect(restoredContent).not.toContain("POST-SNAPSHOT");

    const activity = await prisma.activityLog.findFirst({
      where: { pageId, action: "revision.restored", actorId: ownerId },
    });
    expect(activity).not.toBeNull();
  });

  it("loads the durable document after a collaboration server restart", async () => {
    const expected = restoredContent ?? documents[0]!.getText("body").toString();
    for (const value of providers.splice(0)) value.destroy();
    await server.close();
    await startServer();

    const freshDocument = new Y.Doc();
    documents.push(freshDocument);
    const freshProvider = provider(serverUrl, pageId, freshDocument, ownerToken, activeGeneration);
    providers.push(freshProvider);
    await waitForSync(freshProvider);
    await waitFor(() => freshDocument.getText("body").toString() === expected, "restart state restoration");
    expect(freshDocument.getText("body").toString()).toBe(expected);
  });
});
