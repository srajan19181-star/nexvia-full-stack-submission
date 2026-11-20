import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { prisma, type Role } from "@aureva/database";
import { env } from "./config";
import { AppError } from "./http";

export type Principal = { id: string; email: string; name: string; roles: Role[]; vendorId?: string };
declare global { namespace Express { interface Request { user?: Principal } } }
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function signAccess(user: Principal) {
  return new SignJWT({ email: user.email, name: user.name, roles: user.roles, vendorId: user.vendorId }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`).sign(accessKey);
}
export async function createRefresh(userId: string, request: Request, familyId = randomBytes(16).toString("hex")) {
  const id = randomBytes(16).toString("hex");
  const token = await new SignJWT({ familyId, tokenId: id }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${env.REFRESH_TOKEN_TTL_DAYS}d`).sign(refreshKey);
  await prisma.refreshSession.create({ data: { id, userId, tokenHash: hash(token), familyId, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000), ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null } });
  return token;
}
export function setAuthCookies(response: Response, access: string, refresh: string) {
  const secure = env.NODE_ENV === "production";
  response.cookie("aureva_access", access, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60_000 });
  response.cookie("aureva_refresh", refresh, { httpOnly: true, secure, sameSite: "lax", path: "/api/v1/auth", maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
  const csrf = randomBytes(24).toString("base64url");
  response.cookie("aureva_csrf", csrf, { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
  return csrf;
}
export function clearAuthCookies(response: Response) { response.clearCookie("aureva_access", { path: "/" }); response.clearCookie("aureva_refresh", { path: "/api/v1/auth" }); response.clearCookie("aureva_csrf", { path: "/" }); }

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.aureva_access as string | undefined;
    if (!token) throw new AppError(401, "AUTH_REQUIRED", "Authentication required");
    const { payload } = await jwtVerify(token, accessKey);
    if (!payload.sub) throw new AppError(401, "INVALID_SESSION", "Your session has expired");
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { vendor: { select: { id: true } } } });
    if (!user || user.status !== "ACTIVE") throw new AppError(401, "ACCOUNT_UNAVAILABLE", "Account is unavailable");
    request.user = { id: user.id, email: user.email, name: user.name, roles: user.roles, ...(user.vendor ? { vendorId: user.vendor.id } : {}) };
    next();
  } catch (error) { next(error instanceof AppError ? error : new AppError(401, "INVALID_SESSION", "Your session has expired")); }
}
export const optionalAuthenticate = async (request: Request, response: Response, next: NextFunction) => request.cookies?.aureva_access ? authenticate(request, response, next) : next();
export const requireRole = (...roles: Role[]) => (request: Request, _response: Response, next: NextFunction) => request.user && roles.some((role) => request.user!.roles.includes(role)) ? next() : next(new AppError(403, "FORBIDDEN", "You do not have permission for this action"));
export function csrfProtection(request: Request, _response: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) || request.path.startsWith("/auth/") || request.path.startsWith("/webhooks/")) return next();
  const cookie = request.cookies?.aureva_csrf as string | undefined; const header = request.get("x-csrf-token");
  if (!cookie || !header || cookie.length !== header.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) return next(new AppError(403, "CSRF_INVALID", "Security token is missing or invalid"));
  next();
}
export async function verifyRefresh(token: string) {
  const { payload } = await jwtVerify(token, refreshKey);
  if (!payload.sub || typeof payload.tokenId !== "string" || typeof payload.familyId !== "string") throw new AppError(401, "INVALID_REFRESH", "Invalid refresh token");
  return { userId: payload.sub, tokenId: payload.tokenId, familyId: payload.familyId };
}
export { hash };
