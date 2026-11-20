import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { config } from "dotenv";

if (!process.env.DATABASE_URL) config({ path: [".env", "../../.env"] });

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalDatabase.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;
export * from "../generated/prisma/client";
