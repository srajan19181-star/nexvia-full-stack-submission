import { randomBytes } from "node:crypto";
import { Router } from "express";
import argon2 from "argon2";
import { prisma } from "@aureva/database";
import { emailSchema, loginSchema, passwordSchema, registerSchema } from "@aureva/shared";
import { authenticate, clearAuthCookies, createRefresh, hash, setAuthCookies, signAccess, verifyRefresh } from "../auth";
import { asyncRoute, AppError, ok, validate } from "../http";
import { env } from "../config";
import { passwordResetEmail, sendEmail, verificationEmail } from "../email";
import { z } from "zod";

export const authRoutes = Router();
const publicUser = (user: { id: string; email: string; name: string; roles: string[]; avatarUrl: string | null; emailVerifiedAt?: Date | null; vendor?: { id: string; status: string } | null }) => ({ id: user.id, email: user.email, name: user.name, roles: user.roles, avatarUrl: user.avatarUrl, emailVerified: Boolean(user.emailVerifiedAt), vendor: user.vendor ?? null });

async function issueVerification(user: { id: string; email: string; name: string }) {
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 86_400_000) } });
  const url = `${env.WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, ...verificationEmail(user.name, url) });
  return env.NODE_ENV === "development" ? url : undefined;
}

authRoutes.post("/register", asyncRoute(async (request, response) => {
  const input = validate(registerSchema, request.body);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw new AppError(409, "EMAIL_EXISTS", "An account already exists for this email");
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.user.create({ data: { email: input.email, name: input.name, passwordHash, status: "PENDING_VERIFICATION", customerProfile: { create: {} }, wishlist: { create: {} } }, include: { vendor: true } });
  const developmentVerificationUrl = await issueVerification(user);
  return ok(response, { user: publicUser(user), verificationRequired: true, ...(developmentVerificationUrl ? { developmentVerificationUrl } : {}) }, 201);
}));
authRoutes.post("/login", asyncRoute(async (request, response) => {
  const input = validate(loginSchema, request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { vendor: true } });
  if (!user || !(await argon2.verify(user.passwordHash, input.password))) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  if (user.status === "PENDING_VERIFICATION") throw new AppError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email address before signing in");
  if (user.status !== "ACTIVE") throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is unavailable");
  const principal = { id: user.id, email: user.email, name: user.name, roles: user.roles, ...(user.vendor ? { vendorId: user.vendor.id } : {}) };
  setAuthCookies(response, await signAccess(principal), await createRefresh(user.id, request));
  return ok(response, { user: publicUser(user) });
}));
authRoutes.post("/refresh", asyncRoute(async (request, response) => {
  const token = request.cookies?.aureva_refresh as string | undefined;
  if (!token) throw new AppError(401, "INVALID_REFRESH", "Refresh token is missing");
  const decoded = await verifyRefresh(token);
  const session = await prisma.refreshSession.findUnique({ where: { id: decoded.tokenId }, include: { user: { include: { vendor: true } } } });
  if (!session || session.revokedAt || session.tokenHash !== hash(token) || session.expiresAt < new Date()) {
    await prisma.refreshSession.updateMany({ where: { familyId: decoded.familyId }, data: { revokedAt: new Date() } });
    throw new AppError(401, "REFRESH_REUSE", "Session is no longer valid");
  }
  const nextRefresh = await createRefresh(session.userId, request, session.familyId);
  const nextDecoded = await verifyRefresh(nextRefresh);
  await prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), replacedById: nextDecoded.tokenId } });
  const principal = { id: session.user.id, email: session.user.email, name: session.user.name, roles: session.user.roles, ...(session.user.vendor ? { vendorId: session.user.vendor.id } : {}) };
  setAuthCookies(response, await signAccess(principal), nextRefresh);
  return ok(response, { user: publicUser(session.user) });
}));
authRoutes.post("/logout", asyncRoute(async (request, response) => { const token = request.cookies?.aureva_refresh as string | undefined; if (token) { try { const decoded = await verifyRefresh(token); await prisma.refreshSession.updateMany({ where: { id: decoded.tokenId }, data: { revokedAt: new Date() } }); } catch { request.log.debug("Ignored an invalid refresh cookie during logout"); } } clearAuthCookies(response); return ok(response, { loggedOut: true }); }));
authRoutes.get("/me", authenticate, asyncRoute(async (request, response) => { const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id }, include: { vendor: true } }); return ok(response, { user: publicUser(user) }); }));
authRoutes.post("/verify-email", asyncRoute(async (request, response) => { const { token } = validate(z.object({ token: z.string().min(20) }), request.body); const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hash(token) } }); if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError(400, "VERIFICATION_INVALID", "Verification link is invalid or expired"); await prisma.$transaction([prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }), prisma.user.update({ where: { id: record.userId }, data: { status: "ACTIVE", emailVerifiedAt: new Date() } })]); return ok(response, { verified: true }); }));
authRoutes.post("/resend-verification", asyncRoute(async (request, response) => { const { email } = validate(z.object({ email: emailSchema }), request.body); const user = await prisma.user.findUnique({ where: { email } }); let developmentVerificationUrl: string | undefined; if (user && !user.emailVerifiedAt) developmentVerificationUrl = await issueVerification(user); return ok(response, { message: "If that account needs verification, a new link has been sent.", ...(developmentVerificationUrl ? { developmentVerificationUrl } : {}) }); }));
authRoutes.post("/forgot-password", asyncRoute(async (request, response) => { const { email } = validate(z.object({ email: emailSchema }), request.body); const user = await prisma.user.findUnique({ where: { email } }); let developmentResetUrl: string | undefined; if (user) { const token = randomBytes(32).toString("base64url"); await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }); await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3_600_000) } }); const url = `${env.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`; await sendEmail({ to: user.email, ...passwordResetEmail(user.name, url) }); if (env.NODE_ENV === "development") developmentResetUrl = url; request.log.info({ userId: user.id }, "Password reset requested"); } return ok(response, { message: "If that account exists, password reset instructions have been sent.", ...(developmentResetUrl ? { developmentResetUrl } : {}) }); }));
authRoutes.post("/reset-password", asyncRoute(async (request, response) => { const input = validate(z.object({ token: z.string().min(20), password: passwordSchema }), request.body); const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash(input.token) } }); if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError(400, "RESET_INVALID", "Reset link is invalid or expired"); await prisma.$transaction([prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await argon2.hash(input.password) } }), prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }), prisma.refreshSession.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } })]); return ok(response, { reset: true }); }));
