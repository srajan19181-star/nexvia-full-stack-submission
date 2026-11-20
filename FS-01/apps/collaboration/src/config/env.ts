import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const collaborationEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  COLLABORATION_HOST: z.string().default("0.0.0.0"),
  COLLABORATION_PORT: z.coerce.number().int().min(0).max(65_535).default(4_001),
  COLLABORATION_INSTANCE_ID: z.string().min(3).optional(),
  COLLABORATION_MAX_MESSAGE_BYTES: z.coerce.number().int().min(1_024).max(16 * 1_024 * 1_024).default(2 * 1_024 * 1_024),
  COLLABORATION_ROOM_IDLE_MS: z.coerce.number().int().min(1_000).max(60 * 60 * 1_000).default(60_000),
  COLLABORATION_COMPACT_EVERY_UPDATES: z.coerce.number().int().min(2).max(10_000).default(100),
  COLLABORATION_SNAPSHOT_EVERY_UPDATES: z.coerce.number().int().min(2).max(100_000).default(250),
  COLLABORATION_PING_INTERVAL_MS: z.coerce.number().int().min(1_000).max(120_000).default(25_000),
  COLLABORATION_INTERNAL_SECRET: z.string().min(32).default("development-collaboration-internal-secret-change-me"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  COLLABORATION_REDIS_CHANNEL_PREFIX: z.string().min(3).max(128).default("nexvia:collaboration"),
  COLLABORATION_RECONCILE_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(2_000),
  WEB_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((value, context) => {
      const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
      for (const origin of origins) {
        try {
          if (new URL(origin).origin !== origin) throw new Error("Origin must not include a path");
        } catch {
          context.addIssue({ code: "custom", message: `Invalid WEB_ORIGIN entry: ${origin}` });
        }
      }
      return origins;
    }),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default("nexvia_session"),
  SESSION_SECRET: z.string().min(32),
  TRUST_PROXY: booleanString,
});

type ParsedCollaborationEnv = z.infer<typeof collaborationEnvSchema>;
export type CollaborationEnv = ParsedCollaborationEnv & { instanceId: string };

export function parseCollaborationEnv(source: NodeJS.ProcessEnv = process.env): CollaborationEnv {
  const parsed = collaborationEnvSchema.parse(source);
  return {
    ...parsed,
    instanceId: parsed.COLLABORATION_INSTANCE_ID ?? `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`,
  };
}
