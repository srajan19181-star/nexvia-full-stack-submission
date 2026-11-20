import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4_000),
    APP_URL: z.string().url().default("http://localhost:5173"),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    DATABASE_URL: z.string().min(1),
    SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default("nexvia_session"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    SESSION_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    COLLABORATION_INTERNAL_URL: z.string().url().default("http://localhost:4001"),
    COLLABORATION_INTERNAL_SECRET: z.string().min(32).default("development-collaboration-internal-secret-change-me"),
    TRUST_PROXY: booleanString,
    MAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
    MAIL_FROM: z.string().min(3).default("Orvyn Workspace <no-reply@example.test>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: booleanString,
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && value.MAIL_TRANSPORT !== "smtp") {
      context.addIssue({
        code: "custom",
        path: ["MAIL_TRANSPORT"],
        message: "Production password reset delivery requires MAIL_TRANSPORT=smtp",
      });
    }

    if (value.MAIL_TRANSPORT === "smtp" && (!value.SMTP_HOST || !value.SMTP_USER || !value.SMTP_PASSWORD)) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required for SMTP delivery",
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
