import type { CookieOptions, Response } from "express";
import type { ApiEnv } from "../config/env.js";

export function sessionCookieName(env: ApiEnv): string {
  return env.NODE_ENV === "production" ? `__Host-${env.SESSION_COOKIE_NAME}` : env.SESSION_COOKIE_NAME;
}

export function csrfCookieName(env: ApiEnv): string {
  return env.NODE_ENV === "production" ? "__Host-nexvia_csrf" : "nexvia_csrf";
}

export function sessionCookieOptions(env: ApiEnv): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000,
  };
}

export function csrfCookieOptions(env: ApiEnv): CookieOptions {
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 2 * 60 * 60 * 1_000,
  };
}

export function clearAuthenticationCookies(response: Response, env: ApiEnv): void {
  response.clearCookie(sessionCookieName(env), sessionCookieOptions(env));
  response.clearCookie(csrfCookieName(env), csrfCookieOptions(env));
}
