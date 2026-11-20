import { createServer } from "node:http";
import { prisma } from "@aureva/database";
import { createApp } from "./app";
import { env } from "./config";
import { initializeSearchIndex, processSearchOutbox } from "./search";
import { startCache, stopCache } from "./cache";
import { releaseExpiredReservations } from "./reservations";

await startCache().catch((error) => console.error("Redis unavailable; continuing without cache", error));
await initializeSearchIndex()
  .then(({ bootstrapped, indexed }) => {
    if (bootstrapped) console.log(`Search index bootstrapped with ${indexed} active products`);
  })
  .catch((error) => console.error("Elasticsearch unavailable; PostgreSQL search fallback enabled", error));
const server = createServer(createApp());
server.listen(env.PORT, () => console.log(`AUREVA API listening on http://localhost:${env.PORT}`));
const searchTimer = setInterval(() => {
  void processSearchOutbox().catch((error) => console.error("Search outbox processing failed", error));
}, 5_000);
searchTimer.unref();
const reservationTimer = setInterval(() => void releaseExpiredReservations().catch((error) => console.error("Reservation cleanup failed", error)), 60_000); reservationTimer.unref();
async function shutdown(signal: string) { console.log(`${signal}: shutting down`); clearInterval(searchTimer); clearInterval(reservationTimer); server.close(async () => { await stopCache(); await prisma.$disconnect(); process.exit(0); }); setTimeout(() => process.exit(1), 10_000).unref(); }
process.on("SIGTERM", () => void shutdown("SIGTERM")); process.on("SIGINT", () => void shutdown("SIGINT"));
