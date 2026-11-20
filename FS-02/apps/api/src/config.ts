import { config } from "dotenv";
import { z } from "zod";
config({ path: [".env", "../../.env"] });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4100),
  WEB_URL: z.string().url().default("http://localhost:5174"),
  DATABASE_URL: z.string().min(1), REDIS_URL: z.string().url(), ELASTICSEARCH_URL: z.string().url(),
  ELASTICSEARCH_REPLICAS: z.coerce.number().int().min(0).max(10).default(0),
  JWT_ACCESS_SECRET: z.string().min(32), JWT_REFRESH_SECRET: z.string().min(32), COOKIE_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15), REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGINS: z.string().default("http://localhost:5174"),
  S3_ENDPOINT: z.string().url(), S3_INTERNAL_ENDPOINT: z.string().url().optional(), S3_PUBLIC_ENDPOINT: z.string().url().optional(), S3_REGION: z.string().default("us-east-1"), S3_BUCKET: z.string().min(3), S3_ACCESS_KEY: z.string(), S3_SECRET_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string().optional().default(""), STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_CONNECT_RETURN_URL: z.string().url().optional(), STRIPE_CONNECT_REFRESH_URL: z.string().url().optional(),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"), RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().min(3).default("noreply@example.com"),
  CARRIER_WEBHOOK_SECRET: z.string().optional().default(""),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
});
export const env = schema.parse(process.env);
export const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
export const s3InternalEndpoint = env.S3_INTERNAL_ENDPOINT ?? env.S3_ENDPOINT;
export const s3PublicEndpoint = env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT;
