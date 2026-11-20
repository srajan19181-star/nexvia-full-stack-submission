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
  SESSION_SECRET: "test-session-secret-that-is-at-least-thirty-two-characters",
  CSRF_SECRET: "test-csrf-secret-that-is-also-at-least-thirty-two-characters",
  MAIL_TRANSPORT: "log",
});

class CapturingMailer implements Mailer {
  readonly messages: PasswordResetMessage[] = [];

  async sendPasswordReset(message: PasswordResetMessage): Promise<void> {
    this.messages.push(message);
  }

  async sendWorkspaceInvitation(_message: WorkspaceInvitationMessage): Promise<void> {}
}

async function csrf(agent: Agent): Promise<string> {
  const response = await agent.get("/api/v1/auth/csrf").expect(200);
  return response.body.csrfToken as string;
}

describe("authentication API", () => {
  let prisma: PrismaClient;
  let agent: Agent;
  let mailer: CapturingMailer;
  const email = `auth-${Date.now()}@example.test`;

  beforeAll(async () => {
    prisma = createDatabaseClient({ connectionString: testDatabaseUrl, maxConnections: 2 });
    mailer = new CapturingMailer();
    const app = createApp({ env, prisma, mailer, logger: pino({ level: "silent" }) });
    agent = request.agent(app);
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("rejects a state-changing request without CSRF proof", async () => {
    const response = await request(createApp({ env, prisma, mailer, logger: pino({ level: "silent" }) }))
      .post("/api/v1/auth/register")
      .send({ name: "Security Test", email, password: "SecurePassword!2026" })
      .expect(403);

    expect(response.body.error.code).toBe("INVALID_CSRF_TOKEN");
  });

  it("registers with an HttpOnly session and resolves the current user", async () => {
    const csrfToken = await csrf(agent);
    const registration = await agent
      .post("/api/v1/auth/register")
      .set("x-csrf-token", csrfToken)
      .send({ name: "Integration User", email, password: "SecurePassword!2026" })
      .expect(201);

    expect(registration.body.data.user.email).toBe(email);
    const setCookie = registration.headers["set-cookie"];
    expect(Array.isArray(setCookie) ? setCookie.join(";") : setCookie).toContain("HttpOnly");

    const currentUser = await agent.get("/api/v1/auth/me").expect(200);
    expect(currentUser.body.data.user.name).toBe("Integration User");
  });

  it("revokes the active session on logout", async () => {
    const csrfToken = await csrf(agent);
    await agent.post("/api/v1/auth/logout").set("x-csrf-token", csrfToken).expect(204);
    await agent.get("/api/v1/auth/me").expect(401);
  });

  it("keeps login errors generic and accepts the valid password", async () => {
    let csrfToken = await csrf(agent);
    const invalid = await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .send({ email, password: "IncorrectPassword!2026" })
      .expect(401);
    expect(invalid.body.error.message).toBe("The email or password is incorrect");

    csrfToken = await csrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .send({ email, password: "SecurePassword!2026" })
      .expect(200);
  });

  it("updates validated profile and theme preferences", async () => {
    const csrfToken = await csrf(agent);
    const response = await agent
      .patch("/api/v1/auth/me")
      .set("x-csrf-token", csrfToken)
      .send({
        name: "Updated Integration User",
        avatarUrl: "https://example.test/avatar.png",
        theme: "DARK",
      })
      .expect(200);

    expect(response.body.data.user).toMatchObject({
      name: "Updated Integration User",
      avatarUrl: "https://example.test/avatar.png",
      theme: "DARK",
    });

    const persisted = await agent.get("/api/v1/auth/me").expect(200);
    expect(persisted.body.data.user.name).toBe("Updated Integration User");
  });

  it("resets the password and revokes every existing session", async () => {
    let csrfToken = await csrf(agent);
    await agent
      .post("/api/v1/auth/forgot-password")
      .set("x-csrf-token", csrfToken)
      .send({ email })
      .expect(202);

    const resetMessage = mailer.messages.at(-1);
    expect(resetMessage?.email).toBe(email);

    csrfToken = await csrf(agent);
    await agent
      .post("/api/v1/auth/reset-password")
      .set("x-csrf-token", csrfToken)
      .send({ token: resetMessage!.token, password: "NewSecurePassword!2026" })
      .expect(204);

    await agent.get("/api/v1/auth/me").expect(401);

    csrfToken = await csrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .send({ email, password: "SecurePassword!2026" })
      .expect(401);

    csrfToken = await csrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .send({ email, password: "NewSecurePassword!2026" })
      .expect(200);
  });

  it("returns the same reset response for an unknown email", async () => {
    const csrfToken = await csrf(agent);
    const response = await agent
      .post("/api/v1/auth/forgot-password")
      .set("x-csrf-token", csrfToken)
      .send({ email: "missing@example.test" })
      .expect(202);

    expect(response.body.message).toMatch(/if an account exists/i);
  });
});
