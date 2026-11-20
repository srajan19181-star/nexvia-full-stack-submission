import type { NextFunction, Request, Response } from "express";
import type { ApiEnv } from "../config/env.js";
import { sessionCookieName, sessionCookieOptions } from "../lib/cookies.js";
import { unauthorized } from "../lib/errors.js";
import type { AuthService } from "../services/auth.service.js";

export function authenticateRequest(authService: AuthService, env: ApiEnv) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const token = request.cookies[sessionCookieName(env)] as string | undefined;
    if (!token) {
      next();
      return;
    }

    const authentication = await authService.resolveSession(token);
    if (!authentication) {
      response.clearCookie(sessionCookieName(env), sessionCookieOptions(env));
      next();
      return;
    }

    request.auth = authentication;
    next();
  };
}

export function requireAuthentication(request: Request, _response: Response, next: NextFunction): void {
  if (!request.auth) {
    next(unauthorized());
    return;
  }

  next();
}
