import { createDatabaseClient, type PrismaClient } from "@nexvia/database";
import pino from "pino";
import request, { type Agent } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { apiEnvSchema } from "../src/config/env.js";
import type {
  Mailer,
  PasswordResetMessage,
  WorkspaceInvitationMessage,
} from "../src/services/email.service.js";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://nexvia:nexvia_dev_password@localhost:5432/nexvia_test?schema=public";

const env = apiEnvSchema.parse({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: testDatabaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  APP_URL: "http://localhost:5173",
  SESSION_SECRET: "workspace-session-secret-that-is-at-least-thirty-two-characters",
  CSRF_SECRET: "workspace-csrf-secret-that-is-at-least-thirty-two-characters",
  MAIL_TRANSPORT: "log",
});

class WorkspaceTestMailer implements Mailer {
  readonly invitations: WorkspaceInvitationMessage[] = [];

  async sendPasswordReset(_message: PasswordResetMessage): Promise<void> {}

  async sendWorkspaceInvitation(message: WorkspaceInvitationMessage): Promise<void> {
    this.invitations.push(message);
  }
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

describe("workspace and page APIs", () => {
  let prisma: PrismaClient;
  let owner: Agent;
  let collaborator: Agent;
  let mailer: WorkspaceTestMailer;
  let workspaceId: string;
  let rootPageId: string;
  let childPageId: string;
  const runId = Date.now();
  const ownerEmail = `owner-${runId}@example.test`;
  const collaboratorEmail = `collaborator-${runId}@example.test`;

  beforeAll(async () => {
    prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 3 });
    mailer = new WorkspaceTestMailer();
    const app = createApp({ env, prisma, mailer, logger: pino({ level: "silent" }) });
    owner = request.agent(app);
    collaborator = request.agent(app);
    await register(owner, "Workspace Owner", ownerEmail);
    await register(collaborator, "Comment Collaborator", collaboratorEmail);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, collaboratorEmail] } },
      select: { id: true },
    });
    await prisma.workspace.deleteMany({ where: { createdById: { in: users.map((user) => user.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await prisma.$disconnect();
  });

  it("creates and lists a private workspace", async () => {
    const token = await csrf(owner);
    const created = await owner
      .post("/api/v1/workspaces")
      .set("x-csrf-token", token)
      .send({ name: "Launch Operations" })
      .expect(201);

    workspaceId = created.body.data.workspace.id as string;
    expect(created.body.data.workspace.workspaceRole).toBe("OWNER");

    const list = await owner.get("/api/v1/workspaces").expect(200);
    expect(list.body.data.workspaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workspaceId, name: "Launch Operations" })]),
    );
  });

  it("creates nested pages and rejects a cyclic move", async () => {
    let token = await csrf(owner);
    const root = await owner
      .post(`/api/v1/workspaces/${workspaceId}/pages`)
      .set("x-csrf-token", token)
      .send({ title: "Launch brief", icon: "🚀" })
      .expect(201);
    rootPageId = root.body.data.page.id as string;

    token = await csrf(owner);
    const child = await owner
      .post(`/api/v1/workspaces/${workspaceId}/pages`)
      .set("x-csrf-token", token)
      .send({ title: "Research notes", parentId: rootPageId })
      .expect(201);
    childPageId = child.body.data.page.id as string;

    token = await csrf(owner);
    const cycle = await owner
      .patch(`/api/v1/workspaces/${workspaceId}/pages/${rootPageId}`)
      .set("x-csrf-token", token)
      .send({ parentId: childPageId })
      .expect(409);
    expect(cycle.body.error.code).toBe("INVALID_PAGE_PARENT");
  });

  it("invites a commenter and enforces write denial until promotion", async () => {
    let token = await csrf(owner);
    await owner
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("x-csrf-token", token)
      .send({ email: collaboratorEmail, workspaceRole: "MEMBER", contentRole: "COMMENTER" })
      .expect(201);

    const invitation = mailer.invitations.find((message) => message.email === collaboratorEmail);
    expect(invitation).toBeDefined();

    token = await csrf(collaborator);
    await collaborator
      .post("/api/v1/workspaces/invitations/accept")
      .set("x-csrf-token", token)
      .send({ token: invitation!.token })
      .expect(200);

    token = await csrf(collaborator);
    const denied = await collaborator
      .post(`/api/v1/workspaces/${workspaceId}/pages`)
      .set("x-csrf-token", token)
      .send({ title: "Commenter should not create" })
      .expect(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const members = await owner.get(`/api/v1/workspaces/${workspaceId}/members`).expect(200);
    const collaboratorMember = members.body.data.members.find(
      (member: { user: { email: string } }) => member.user.email === collaboratorEmail,
    );

    token = await csrf(owner);
    await owner
      .patch(`/api/v1/workspaces/${workspaceId}/members/${collaboratorMember.id}`)
      .set("x-csrf-token", token)
      .send({ contentRole: "EDITOR" })
      .expect(200);

    token = await csrf(collaborator);
    await collaborator
      .post(`/api/v1/workspaces/${workspaceId}/pages`)
      .set("x-csrf-token", token)
      .send({ title: "Editor contribution" })
      .expect(201);
  });

  it("favorites, trashes, and restores a page subtree", async () => {
    let token = await csrf(owner);
    await owner
      .post(`/api/v1/workspaces/${workspaceId}/pages/${rootPageId}/favorite`)
      .set("x-csrf-token", token)
      .expect(204);

    let pages = await owner.get(`/api/v1/workspaces/${workspaceId}/pages`).expect(200);
    expect(pages.body.data.pages.find((page: { id: string }) => page.id === rootPageId).isFavorite).toBe(true);

    token = await csrf(owner);
    await owner
      .delete(`/api/v1/workspaces/${workspaceId}/pages/${rootPageId}`)
      .set("x-csrf-token", token)
      .expect(204);

    pages = await owner.get(`/api/v1/workspaces/${workspaceId}/pages?includeDeleted=true`).expect(200);
    expect(pages.body.data.pages.find((page: { id: string }) => page.id === rootPageId).deletedAt).toBeTruthy();
    expect(pages.body.data.pages.find((page: { id: string }) => page.id === childPageId).deletedAt).toBeTruthy();

    token = await csrf(owner);
    await owner
      .post(`/api/v1/workspaces/${workspaceId}/pages/${rootPageId}/restore`)
      .set("x-csrf-token", token)
      .expect(200);

    pages = await owner.get(`/api/v1/workspaces/${workspaceId}/pages`).expect(200);
    expect(pages.body.data.pages.map((page: { id: string }) => page.id)).toEqual(
      expect.arrayContaining([rootPageId, childPageId]),
    );
  });

  it("searches accessible pages and returns an auditable activity feed", async () => {
    const search = await collaborator.get("/api/v1/search?q=Launch").expect(200);
    expect(search.body.data.pages).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: rootPageId, title: "Launch brief" })]),
    );
    expect(search.body.data.workspaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workspaceId, name: "Launch Operations" })]),
    );

    const activity = await owner.get(`/api/v1/workspaces/${workspaceId}/activity?limit=50`).expect(200);
    const actions = activity.body.data.items.map((item: { action: string }) => item.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "workspace.created",
        "member.invited",
        "invitation.accepted",
        "member.permission_changed",
        "page.created",
        "page.deleted",
        "page.restored",
      ]),
    );
    expect(activity.body.data.items[0].id).toEqual(expect.any(String));
  });

  it("prevents a non-admin member from changing workspace settings", async () => {
    const token = await csrf(collaborator);
    await collaborator
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set("x-csrf-token", token)
      .send({ name: "Unauthorized rename" })
      .expect(403);
  });
});
