import { createHash } from "node:crypto";
import { createDatabaseClient, type PrismaClient } from "@nexvia/database";
import pino from "pino";
import request, { type Agent } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createApp } from "../src/app.js";
import { apiEnvSchema } from "../src/config/env.js";
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
  SESSION_SECRET: "comment-session-secret-that-is-at-least-thirty-two-characters",
  CSRF_SECRET: "comment-csrf-secret-that-is-at-least-thirty-two-characters",
  MAIL_TRANSPORT: "log",
});

class NoopMailer implements Mailer {
  async sendPasswordReset(_message: PasswordResetMessage): Promise<void> {}
  async sendWorkspaceInvitation(_message: WorkspaceInvitationMessage): Promise<void> {}
}

async function csrf(agent: Agent): Promise<string> {
  const response = await agent.get("/api/v1/auth/csrf").expect(200);
  return response.body.csrfToken as string;
}

async function register(agent: Agent, name: string, email: string): Promise<void> {
  const token = await csrf(agent);
  await agent
    .post("/api/v1/auth/register")
    .set("x-csrf-token", token)
    .send({ name, email, password: "SecureWorkspace!2026" })
    .expect(201);
}

function encode(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function bytes(value: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

describe("comment APIs", () => {
  let prisma: PrismaClient;
  let owner: Agent;
  let commenter: Agent;
  let viewer: Agent;
  let workspaceId: string;
  let pageId: string;
  let commentId: string;
  let replyId: string;
  let initialDocument: Y.Doc;
  const runId = Date.now();
  const ownerEmail = `comment-owner-${runId}@example.test`;
  const commenterEmail = `commenter-${runId}@example.test`;
  const viewerEmail = `viewer-${runId}@example.test`;

  beforeAll(async () => {
    prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 4 });
    const app = createApp({ env, prisma, mailer: new NoopMailer(), logger: pino({ level: "silent" }) });
    owner = request.agent(app);
    commenter = request.agent(app);
    viewer = request.agent(app);
    await register(owner, "Comment Owner", ownerEmail);
    await register(commenter, "Commenter", commenterEmail);
    await register(viewer, "Viewer", viewerEmail);

    let token = await csrf(owner);
    const workspace = await owner
      .post("/api/v1/workspaces")
      .set("x-csrf-token", token)
      .send({ name: "Comment review" })
      .expect(201);
    workspaceId = workspace.body.data.workspace.id as string;

    token = await csrf(owner);
    const page = await owner
      .post(`/api/v1/workspaces/${workspaceId}/pages`)
      .set("x-csrf-token", token)
      .send({ title: "Review draft" })
      .expect(201);
    pageId = page.body.data.page.id as string;

    const users = await prisma.user.findMany({
      where: { email: { in: [commenterEmail, viewerEmail] } },
      select: { id: true, email: true },
    });
    await prisma.workspaceMember.createMany({
      data: users.map((user) => ({
        workspaceId,
        userId: user.id,
        contentRole: user.email === commenterEmail ? "COMMENTER" : "VIEWER",
      })),
    });

    initialDocument = new Y.Doc();
    initialDocument.getText("content").insert(0, "Hello collaborative world");
    await prisma.documentState.create({
      data: {
        pageId,
        state: bytes(Y.encodeStateAsUpdate(initialDocument)),
        stateVector: bytes(Y.encodeStateVector(initialDocument)),
      },
    });
  });

  afterAll(async () => {
    initialDocument.destroy();
    const users = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, commenterEmail, viewerEmail] } },
      select: { id: true },
    });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await prisma.$disconnect();
  });

  it("creates a collaboration-safe range comment", async () => {
    const content = initialDocument.getText("content");
    const token = await csrf(commenter);
    const response = await commenter
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments`)
      .set("x-csrf-token", token)
      .send({
        body: "Can we make this more specific?",
        anchor: {
          start: encode(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(content, 6))),
          end: encode(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(content, 19))),
          stateVector: encode(Y.encodeStateVector(initialDocument)),
          quote: "collaborative",
        },
      })
      .expect(201);

    commentId = response.body.data.comment.id as string;
    expect(response.body.data.comment).toEqual(
      expect.objectContaining({
        body: "Can we make this more specific?",
        anchorQuote: "collaborative",
        anchorStart: expect.any(String),
        canDelete: true,
        canResolve: true,
      }),
    );
  });

  it("supports replies, resolution, and reopening", async () => {
    let token = await csrf(commenter);
    const reply = await commenter
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}/replies`)
      .set("x-csrf-token", token)
      .send({ body: "I added context in the next paragraph." })
      .expect(201);
    replyId = reply.body.data.reply.id as string;

    token = await csrf(commenter);
    await commenter
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}/status`)
      .set("x-csrf-token", token)
      .send({ resolved: true })
      .expect(200);

    let comments = await commenter
      .get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments?includeResolved=false`)
      .expect(200);
    expect(comments.body.data.comments).toHaveLength(0);

    token = await csrf(commenter);
    await commenter
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}/status`)
      .set("x-csrf-token", token)
      .send({ resolved: false })
      .expect(200);

    comments = await commenter
      .get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments`)
      .expect(200);
    expect(comments.body.data.comments[0].replies).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: replyId, canDelete: true })]),
    );
  });

  it("denies every comment mutation to viewers", async () => {
    let token = await csrf(viewer);
    await viewer
      .post(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments`)
      .set("x-csrf-token", token)
      .send({ body: "A viewer must not create this." })
      .expect(403);

    token = await csrf(viewer);
    await viewer
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}/status`)
      .set("x-csrf-token", token)
      .send({ resolved: true })
      .expect(403);

    token = await csrf(viewer);
    await viewer
      .delete(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}`)
      .set("x-csrf-token", token)
      .expect(403);
  });

  it("keeps stored relative anchors valid after a durable concurrent edit", async () => {
    const previousStateVector = Y.encodeStateVector(initialDocument);
    initialDocument.getText("content").insert(0, "Updated: ");
    const update = Y.encodeStateAsUpdate(initialDocument, previousStateVector);
    const updateHash = createHash("sha256").update(update).digest("base64url");
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail }, select: { id: true } });

    await prisma.$transaction(async (transaction) => {
      await transaction.documentUpdate.create({
        data: { pageId, generation: 1, update: bytes(update), updateHash, actorId: actor.id, instanceId: "comment-test" },
      });
      await transaction.documentState.update({ where: { pageId }, data: { version: { increment: 1n } } });
    });

    const stored = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });
    const reconstructed = new Y.Doc();
    const state = await prisma.documentState.findUniqueOrThrow({ where: { pageId } });
    Y.applyUpdate(reconstructed, state.state);
    Y.applyUpdate(reconstructed, update);
    const start = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(stored.anchorStart!),
      reconstructed,
    );
    const end = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(stored.anchorEnd!),
      reconstructed,
    );
    expect(start?.index).toBe(15);
    expect(end?.index).toBe(28);
    reconstructed.destroy();
  });

  it("allows authors and administrators to delete, and audits the lifecycle", async () => {
    let token = await csrf(commenter);
    await commenter
      .delete(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}/replies/${replyId}`)
      .set("x-csrf-token", token)
      .expect(204);

    token = await csrf(owner);
    await owner
      .delete(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}`)
      .set("x-csrf-token", token)
      .expect(204);

    const comments = await owner
      .get(`/api/v1/workspaces/${workspaceId}/pages/${pageId}/comments`)
      .expect(200);
    expect(comments.body.data.comments).toHaveLength(0);

    const activity = await owner.get(`/api/v1/workspaces/${workspaceId}/activity?limit=50`).expect(200);
    expect(activity.body.data.items.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining([
        "comment.created",
        "comment.replied",
        "comment.resolved",
        "comment.reopened",
        "comment.deleted",
      ]),
    );
  });
});
