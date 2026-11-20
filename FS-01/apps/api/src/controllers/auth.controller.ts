import type { Request, Response } from "express";
import type { ApiEnv } from "../config/env.js";
import { createCsrfToken } from "../lib/crypto.js";
import {
  clearAuthenticationCookies,
  csrfCookieName,
  csrfCookieOptions,
  sessionCookieName,
  sessionCookieOptions,
} from "../lib/cookies.js";
import type { AuthService } from "../services/auth.service.js";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly env: ApiEnv,
  ) {}

  register = async (request: Request, response: Response): Promise<void> => {
    const session = await this.authService.register(request.body, this.requestMetadata(request));
    this.setSession(response, session.token);
    const csrfToken = this.rotateCsrf(response);
    response.status(201).json({ data: { user: session.user }, csrfToken });
  };

  login = async (request: Request, response: Response): Promise<void> => {
    const session = await this.authService.login(request.body, this.requestMetadata(request));
    this.setSession(response, session.token);
    const csrfToken = this.rotateCsrf(response);
    response.status(200).json({ data: { user: session.user }, csrfToken });
  };

  me = (request: Request, response: Response): void => {
    response.status(200).json({ data: { user: request.auth!.user } });
  };

  updateProfile = async (request: Request, response: Response): Promise<void> => {
    const user = await this.authService.updateProfile(request.auth!.user.id, request.body);
    response.status(200).json({ data: { user } });
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    await this.authService.revokeSession(request.auth!.sessionId);
    clearAuthenticationCookies(response, this.env);
    response.status(204).send();
  };

  forgotPassword = async (request: Request, response: Response): Promise<void> => {
    await this.authService.requestPasswordReset(request.body.email);
    response.status(202).json({
      message: "If an account exists for that email, a reset link has been sent.",
    });
  };

  resetPassword = async (request: Request, response: Response): Promise<void> => {
    await this.authService.resetPassword(request.body);
    clearAuthenticationCookies(response, this.env);
    response.status(204).send();
  };

  private requestMetadata(request: Request): { ipAddress?: string; userAgent?: string } {
    const userAgent = request.get("user-agent");
    const ipAddress = request.ip;
    return {
      ...(ipAddress === undefined ? {} : { ipAddress }),
      ...(userAgent === undefined ? {} : { userAgent }),
    };
  }

  private setSession(response: Response, token: string): void {
    response.cookie(sessionCookieName(this.env), token, sessionCookieOptions(this.env));
  }

  private rotateCsrf(response: Response): string {
    const csrfToken = createCsrfToken(this.env.CSRF_SECRET);
    response.cookie(csrfCookieName(this.env), csrfToken, csrfCookieOptions(this.env));
    return csrfToken;
  }
}
