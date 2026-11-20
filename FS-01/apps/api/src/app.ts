import type { PrismaClient } from "@nexvia/database";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import type { Logger } from "pino";
import pinoHttp from "pino-http";
import type { ApiEnv } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { authenticateRequest } from "./middleware/authentication.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createActivityRouter } from "./routes/activity.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";
import { createCommentRouter } from "./routes/comment.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createHistoryRouter } from "./routes/history.routes.js";
import { createPageRouter, createSearchRouter } from "./routes/page.routes.js";
import { createPagePermissionRouter } from "./routes/page-permission.routes.js";
import { createWorkspaceRouter } from "./routes/workspace.routes.js";
import { ActivityLogService } from "./services/activity-log.service.js";
import { AuthService } from "./services/auth.service.js";
import { DashboardService } from "./services/dashboard.service.js";
import { CommentService } from "./services/comment.service.js";
import { HistoryService } from "./services/history.service.js";
import { HttpHistoryCoordinator, type HistoryCoordinator } from "./services/history-coordinator.js";
import { createMailer, type Mailer } from "./services/email.service.js";
import { PageService } from "./services/page.service.js";
import { PagePermissionService } from "./services/page-permission.service.js";
import { WorkspaceService } from "./services/workspace.service.js";

export interface AppDependencies {
  env: ApiEnv;
  prisma: PrismaClient;
  logger?: Logger;
  mailer?: Mailer;
  historyCoordinator?: HistoryCoordinator;
}

export function createApp(dependencies: AppDependencies): Express {
  const { env, prisma } = dependencies;
  const logger = dependencies.logger ?? createLogger(env);
  const mailer = dependencies.mailer ?? createMailer(env, logger);
  const authService = new AuthService(prisma, env, mailer, logger);
  const workspaceService = new WorkspaceService(prisma, mailer, logger);
  const pageService = new PageService(prisma);
  const pagePermissionService = new PagePermissionService(prisma);
  const activityService = new ActivityLogService(prisma);
  const dashboardService = new DashboardService(prisma, workspaceService);
  const commentService = new CommentService(prisma);
  const historyService = new HistoryService(prisma, dependencies.historyCoordinator ?? new HttpHistoryCoordinator(env));
  const app = express();

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_request, response) => response.locals.requestId as string,
      autoLogging: env.NODE_ENV !== "test",
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  const allowedOrigins = new Set(env.WEB_ORIGIN.split(",").map((origin) => origin.trim()));
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "x-csrf-token", "x-request-id"],
      exposedHeaders: ["x-request-id", "ratelimit", "ratelimit-policy"],
    }),
  );
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1_000,
      limit: env.NODE_ENV === "test" ? 10_000 : 500,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(authenticateRequest(authService, env));

  app.use("/health", createHealthRouter(prisma));
  app.use("/api/v1/auth", createAuthRouter(authService, env));
  app.use("/api/v1/dashboard", createDashboardRouter(dashboardService));
  app.use("/api/v1/search", createSearchRouter(pageService));
  app.use("/api/v1/workspaces", createWorkspaceRouter(prisma, workspaceService, env));
  app.use("/api/v1/workspaces", createPageRouter(prisma, pageService, env));
  app.use("/api/v1/workspaces", createPagePermissionRouter(prisma, pagePermissionService, env));
  app.use("/api/v1/workspaces", createCommentRouter(prisma, commentService, env));
  app.use("/api/v1/workspaces", createHistoryRouter(prisma, historyService, env));
  app.use("/api/v1/workspaces", createActivityRouter(prisma, activityService));

  app.use(notFoundHandler());
  app.use(createErrorHandler(logger));

  return app;
}
