import type { PrismaClient } from "@nexvia/database";
import { Router } from "express";

export function createHealthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/live", (_request, response) => {
    response.status(200).json({ status: "ok", service: "api" });
  });

  router.get("/ready", async (_request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.status(200).json({ status: "ready", service: "api", dependencies: { database: "up" } });
    } catch {
      response.status(503).json({ status: "not_ready", service: "api", dependencies: { database: "down" } });
    }
  });

  return router;
}
