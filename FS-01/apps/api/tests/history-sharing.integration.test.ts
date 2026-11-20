import { createDatabaseClient, type PrismaClient } from "@nexvia/database";
import pino from "pino";
import request, { type Agent } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createApp } from "../src/app.js";
import { apiEnvSchema } from "../src/config/env.js";
import type { HistoryCoordinator, RestoreCommand, SnapshotCommand } from "../src/services/history-coordinator.js";
import type { Mailer, PasswordResetMessage, WorkspaceInvitationMessage } from "../src/services/email.service.js";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://nexvia:nexvia_dev_password@localhost:5432/nexvia_test?schema=public";

const env = apiEnvSchema.parse({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: testDatabaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  APP_URL: "http://localhost:5173",
  SESSION_SECRET: "history-session-secret-that-is-at-least-thirty-two-characters",
  CSRF_SECRET: "history-csrf-secret-that-is-at-least-thirty-two-characters",
  MAIL_TRANSPORT: "log",
});

class NoopMailer implements Mailer {
  async sendPasswordReset(_message: PasswordResetMessage): Promise<void> {}
  async sendWorkspaceInvitation(_message: WorkspaceInvitationMessage): Promise<void> {}
}

class CapturingHistoryCoordinator implements HistoryCoordinator {
  readonly creates: SnapshotCommand[] = [];
  readonly restores: RestoreCommand[] = [];

  async createSnapshot(command: SnapshotCommand) {
    this.creates.push(command);
    return {
      snapshot: {
        id: "cmhistorycoordinator000001",
        generation: 1,
        kind: "MILESTONE",
        label: command.label ?? null,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async restoreSnapshot(command: RestoreCommand) {
    this.restores.push(command);
    return {
      snapshotId: "cmhistoryrestore000000001",
      preRestoreSnapshotId: "cmhistoryprerestore00001",
      generation: 2,
    };
  }
}

async function csrf(agent: Agent): Promise<string> {
  return (await agent.get("/api/v1/auth/csrf").expect(200)).body.csrfToken as string;
}

async function register(agent: Agent, name: string, email: string): Promise<void> {
  const token = await csrf(agent);
  await agent
    .post("/api/v1/auth/register")
    .set("x-csrf-token", token)
    .send({ name, email, password: "SecureWorkspace!2026" })
    .expect(201);
}

function bytes(value: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

describe("history and page sharing APIs", () => {
  let prisma: PrismaClient;
  let owner: Agent;
  let editor: Agent;
  let viewer: Agent;
  let coordinator: CapturingHistoryCoordinator;
  let workspaceId: string;
  let pageId: string;
  let snapshotId: string;
  let ownerMemberId: string;
  let editorMemberId: string;
  const runId = Date.now();
  const ownerEmail = `history-owner-${runId}@example.test`;
  const editorEmail = `history-editor-${runId}@example.test`;
  const viewerEmail = `history-viewer-${runId}@example.test`;

  beforeAll(async () => {
    prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 4 });
    coordinator = new CapturingHistoryCoordinator();
    const app = createApp({
      env,
      prisma,
      mailer: new NoopMailer(),
      historyCoordinator: coordinator,
      logger: pino({ level: "silent" }),
    });
    owner = request.agent(app);
    editor = request.agent(app);
    viewer = request.agent(app);
    await register(owner, "History Owner", ownerEmail);
    await register(editor, "Page Editor", editorEmail);
    await register(viewer, "History Viewer", viewerEmail);

    let token = await csrf(owner);
    const workspace = await owner
      .post("/api/v1/workspaces")
      .set("x-csrf-token", token)
      .send({ name: "Revision governance" })
      .expect(201);
    workspaceId = workspace.body.data.workspace.id as string;
    token = await csrf(owner);
    const page = await owner
      .post(`/api/v1/workspaces/${workspaceId}/pages`)
      .set("x-csrf-token", token)
      .send({ title: "Governed document" })
      .expect(201);
    pageId = page.body.data.page.id as string;

    const users = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, editorEmail, viewerEmail] } },
      select: { id: true, email: true },
    });
    await prisma.workspaceMember.createMany({
      data: users
        .filter((user) => user.email !== ownerEmail)
        .map((user) => ({
          workspaceId,
          userId: user.id,
          contentRole: user.email === editorEmail ? "EDITOR" : "VIEWER",
        })),
    });
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: true } });
    ownerMemberId = members.find((member) => member.user.email === ownerEmail)!.id;
    editorMemberId = members.find((member) => member.user.email === editorEmail)!.id;

    const document = new Y.Doc();
    document.getText("body").insert(0, "Immutable preview content");
    const state = bytes(Y.encodeStateAsUpdate(document));
    const stateVector = bytes(Y.encodeStateVector(document));
    await prisma.documentState.create({ data: { pageId, state, stateVector } });
    const author = users.find((user) => user.email === ownerEmail)!;
    const snapshot = await prisma.documentSnapshot.create({
      data: {
        pageId,
        generation: 1,
        state,
        stateVector,
        kind: "MILESTONE",
        label: "Approved baseline",
        createdById: author.id,
      },
    });
    snapshotId = snapshot.id;
    document.destroy();
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, editorEmail, viewerEmail] } },
      select: { id: true },
    });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await prisma.$disconnect();
  });

  it("lets viewers list and preview immutable binary revisions", async () => {
    const history = await viewer
      .get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/history?limit=10`)
      .expect(200);
    expect(history.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: snapshotId, label: "Approved baseline" })]),
    );

    const preview = await viewer
      .get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/history/${snapshotId}`)
      .expect(200);
    const previewDocument = new Y.Doc();
    Y.applyUpdate(previewDocument, Buffer.from(preview.body.data.snapshot.state as string, "base64url"));
    expect(previewDocument.getText("body").toString()).toBe("Immutable preview content");
    previewDocument.destroy();
  });

  it("allows editors to create and restore revisions but denies viewers", async () => {
    let token = await csrf(viewer);
    await viewer
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/history`)
      .set("x-csrf-token", token)
      .send({ label: "Viewer attempt" })
      .expect(403);

    token = await csrf(editor);
    await editor
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/history`)
      .set("x-csrf-token", token)
      .send({ label: "Editor checkpoint" })
      .expect(201);
    expect(coordinator.creates.at(-1)).toEqual(expect.objectContaining({ pageId, label: "Editor checkpoint" }));

    token = await csrf(viewer);
    await viewer
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/history/${snapshotId}/restore`)
      .set("x-csrf-token", token)
      .send({})
      .expect(403);
    token = await csrf(editor);
    await editor
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/history/${snapshotId}/restore`)
      .set("x-csrf-token", token)
      .send({ label: "Restore approved baseline" })
      .expect(200);
    expect(coordinator.restores.at(-1)).toEqual(expect.objectContaining({ pageId, snapshotId }));
  });

  it("enforces admin-only page overrides and recalculates effective access", async () => {
    let token = await csrf(editor);
    await editor
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/permissions/${editorMemberId}`)
      .set("x-csrf-token", token)
      .send({ role: "VIEWER" })
      .expect(403);

    token = await csrf(owner);
    await owner
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/permissions/${editorMemberId}`)
      .set("x-csrf-token", token)
      .send({ role: "VIEWER" })
      .expect(200);
    const editorPage = await editor.get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}`).expect(200);
    expect(editorPage.body.data.page.permissions).toMatchObject({ view: true, comment: false, edit: false });

    const sharing = await owner
      .get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/permissions`)
      .expect(200);
    expect(sharing.body.data.permissions.find((item: { id: string }) => item.id === editorMemberId)).toMatchObject({
      pageRole: "VIEWER",
      effectivePermissions: { edit: false, comment: false, view: true },
    });

    token = await csrf(owner);
    await owner
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/permissions/${ownerMemberId}`)
      .set("x-csrf-token", token)
      .send({ role: "VIEWER" })
      .expect(403);

    token = await csrf(owner);
    await owner
      .delete(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/permissions/${editorMemberId}`)
      .set("x-csrf-token", token)
      .expect(204);
    const restoredEditorPage = await editor.get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}`).expect(200);
    expect(restoredEditorPage.body.data.page.permissions.edit).toBe(true);
  });

  it("records page permission changes in the activity log", async () => {
    const activity = await owner.get(`/api/v1/workspaces/${workspaceId}/activity?limit=50`).expect(200);
    expect(activity.body.data.items.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(["page.permission_changed", "page.permission_removed"]),
    );
  });
});
