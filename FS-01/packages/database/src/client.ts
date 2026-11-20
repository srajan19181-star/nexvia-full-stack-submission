import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export interface DatabaseClientOptions {
  connectionString?: string;
  maxConnections?: number;
}

const globalDatabase = globalThis as typeof globalThis & {
  nexviaPrisma?: PrismaClient;
};

export function createDatabaseClient(options: DatabaseClientOptions = {}): PrismaClient {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the Prisma client");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({ adapter });
}

export function getDatabaseClient(): PrismaClient {
  if (!globalDatabase.nexviaPrisma) {
    globalDatabase.nexviaPrisma = createDatabaseClient();
  }

  return globalDatabase.nexviaPrisma;
}

export type { PrismaClient };
