import type { NextFunction, Request, Response } from "express";
import type { ApiEnv } from "../config/env.js";
import { createCsrfToken, verifyCsrfToken } from "../lib/crypto.js";
import { csrfCookieName, csrfCookieOptions } from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";

export function issueCsrfToken(env: ApiEnv) {
  return (_request: Request, response: Response): void => {
    const token = createCsrfToken(env.CSRF_SECRET);
    response.cookie(csrfCookieName(env), token, csrfCookieOptions(env));
    response.status(200).json({ csrfToken: token });
  };
}

export function requireCsrf(env: ApiEnv) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const headerToken = request.get("x-csrf-token");
    const cookieToken = request.cookies[csrfCookieName(env)] as string | undefined;

    if (
      !headerToken ||
      !cookieToken ||
      headerToken !== cookieToken ||
      !verifyCsrfToken(headerToken, env.CSRF_SECRET)
    ) {
      next(
        new AppError({
          statusCode: 403,
          code: "INVALID_CSRF_TOKEN",
          message: "The security token is missing or expired. Refresh and try again.",
        }),
      );
      return;
    }

    next();
  };
}
