import "dotenv/config";
import { createServer } from "node:http";
import { getDatabaseClient } from "@nexvia/database";
import { createApp } from "./app.js";
import { parseApiEnv } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

const env = parseApiEnv();
const logger = createLogger(env);
const prisma = getDatabaseClient();
const app = createApp({ env, prisma, logger });
const server = createServer(app);

server.listen(env.API_PORT, env.API_HOST, () => {
  logger.info({ host: env.API_HOST, port: env.API_PORT }, "API listening");
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (error) => {
    if (error) {
      logger.error({ error }, "HTTP server failed to close cleanly");
      process.exitCode = 1;
    }

    await prisma.$disconnect();
    clearTimeout(forceExitTimer);
    logger.info("Graceful shutdown complete");
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (error) => {
  logger.fatal({ error }, "Unhandled rejection");
  void shutdown("unhandledRejection");
});
