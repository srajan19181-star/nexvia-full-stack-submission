import pino, { type Logger } from "pino";
import type { ApiEnv } from "../config/env.js";

export function createLogger(env: ApiEnv): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: "api", environment: env.NODE_ENV },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "password",
        "token",
        "resetToken",
      ],
      censor: "[REDACTED]",
    },
  });
}
