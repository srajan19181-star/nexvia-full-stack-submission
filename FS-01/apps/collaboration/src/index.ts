import "dotenv/config";
import { createDatabaseClient } from "@nexvia/database";
import pino from "pino";
import { parseCollaborationEnv } from "./config/env.js";
import { createCollaborationServer } from "./server.js";

const env = parseCollaborationEnv();
const logger = pino({ level: env.LOG_LEVEL });
const prisma = createDatabaseClient({ connectionString: env.DATABASE_URL, maxConnections: 10 });
const server = createCollaborationServer({ env, prisma, logger });
const address = await server.listen();
logger.info({ ...address, instanceId: env.instanceId }, "Collaboration service listening");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Collaboration service draining");
  const forceExit = setTimeout(() => {
    logger.fatal("Collaboration shutdown timed out");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    await server.close();
    await prisma.$disconnect();
    clearTimeout(forceExit);
    logger.info("Collaboration service stopped");
  } catch (error) {
    logger.error({ error }, "Collaboration shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
