import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  forgotPasswordInputSchema,
  loginInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  updateProfileInputSchema,
} from "@nexvia/shared";
import type { ApiEnv } from "../config/env.js";
import { AuthController } from "../controllers/auth.controller.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { issueCsrfToken, requireCsrf } from "../middleware/csrf.js";
import { validateBody } from "../middleware/validate.js";
import type { AuthService } from "../services/auth.service.js";

export function createAuthRouter(authService: AuthService, env: ApiEnv): Router {
  const router = Router();
  const controller = new AuthController(authService, env);
  const csrf = requireCsrf(env);
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: env.NODE_ENV === "test" ? 1_000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Too many authentication attempts. Try again later.",
      },
    },
  });

  router.get("/csrf", issueCsrfToken(env));
  router.get("/me", requireAuthentication, controller.me);
  router.patch("/me", csrf, requireAuthentication, validateBody(updateProfileInputSchema), controller.updateProfile);
  router.post("/register", authRateLimit, csrf, validateBody(registerInputSchema), controller.register);
  router.post("/login", authRateLimit, csrf, validateBody(loginInputSchema), controller.login);
  router.post("/logout", csrf, requireAuthentication, controller.logout);
  router.post(
    "/forgot-password",
    authRateLimit,
    csrf,
    validateBody(forgotPasswordInputSchema),
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    authRateLimit,
    csrf,
    validateBody(resetPasswordInputSchema),
    controller.resetPassword,
  );

  return router;
}
