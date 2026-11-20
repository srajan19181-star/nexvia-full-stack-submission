import argon2 from "argon2";
import type { PrismaClient } from "@nexvia/database";
import type { LoginInput, PublicUser, RegisterInput, ResetPasswordInput, UpdateProfileInput } from "@nexvia/shared";
import type { Logger } from "pino";
import type { ApiEnv } from "../config/env.js";
import { createOpaqueToken, hashKeyedToken, hashToken } from "../lib/crypto.js";
import { AppError, unauthorized } from "../lib/errors.js";
import type { Mailer } from "./email.service.js";

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  id: string;
  token: string;
  user: PublicUser;
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  theme: "SYSTEM" | "LIGHT" | "DARK";
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    theme: user.theme,
    createdAt: user.createdAt.toISOString(),
  };
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: ApiEnv,
    private readonly mailer: Mailer,
    private readonly logger: Logger,
  ) {}

  async register(input: RegisterInput, metadata: RequestMetadata): Promise<CreatedSession> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: "EMAIL_ALREADY_REGISTERED",
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
    });

    return this.createSession(user.id, metadata);
  }

  async login(input: LoginInput, metadata: RequestMetadata): Promise<CreatedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const validPassword = user ? await argon2.verify(user.passwordHash, input.password) : false;

    if (!user || !validPassword) {
      throw unauthorized("The email or password is incorrect");
    }

    return this.createSession(user.id, metadata);
  }

  async resolveSession(token: string): Promise<{ sessionId: string; user: PublicUser } | null> {
    const tokenHash = hashKeyedToken(token, this.env.SESSION_SECRET);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1_000) {
      void this.prisma.session
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch((error: unknown) => this.logger.warn({ error, sessionId: session.id }, "Session touch failed"));
    }

    return { sessionId: session.id, user: toPublicUser(session.user) };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
        ...(input.theme === undefined ? {} : { theme: input.theme }),
      },
    });
    return toPublicUser(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const startedAt = Date.now();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = createOpaqueToken(32);
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1_000);

      const resetRecord = await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      try {
        await this.mailer.sendPasswordReset({ email: user.email, name: user.name, token });
      } catch (error) {
        await this.prisma.passwordResetToken.delete({ where: { id: resetRecord.id } }).catch(() => undefined);
        this.logger.error({ error, userId: user.id }, "Password reset delivery failed");
      }
    }

    const remainingDelay = 200 - (Date.now() - startedAt);
    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new AppError({
        statusCode: 400,
        code: "INVALID_RESET_TOKEN",
        message: "This password reset link is invalid or expired",
      });
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new AppError({
          statusCode: 400,
          code: "INVALID_RESET_TOKEN",
          message: "This password reset link is invalid or expired",
        });
      }

      await transaction.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await transaction.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async createSession(userId: string, metadata: RequestMetadata): Promise<CreatedSession> {
    const token = createOpaqueToken(32);
    const tokenHash = hashKeyedToken(token, this.env.SESSION_SECRET);
    const expiresAt = new Date(Date.now() + this.env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ...(metadata.ipAddress === undefined ? {} : { ipAddress: metadata.ipAddress }),
        ...(metadata.userAgent === undefined ? {} : { userAgent: metadata.userAgent }),
      },
      include: { user: true },
    });

    return { id: session.id, token, user: toPublicUser(session.user) };
  }
}
