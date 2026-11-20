import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const ok = <T>(response: Response, data: T, status = 200, meta?: Record<string, unknown>) => response.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
export const asyncRoute = (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>) => (request: Request, response: Response, next: NextFunction) => void handler(request, response, next).catch(next);
export const validate = <T>(schema: ZodType<T>, value: unknown): T => { const result = schema.safeParse(value); if (!result.success) throw new AppError(422, "VALIDATION_ERROR", "The submitted data is invalid", result.error.flatten()); return result.data; };
export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof AppError) return response.status(error.status).json({ success: false, error: { code: error.code, message: error.message, details: error.details } });
  if (error instanceof ZodError) return response.status(422).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() } });
  const databaseCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (databaseCode === "P2002") return response.status(409).json({ success: false, error: { code: "CONFLICT", message: "A record with those unique values already exists" } });
  if (databaseCode === "P2003") return response.status(409).json({ success: false, error: { code: "RELATION_CONFLICT", message: "This record is still referenced by another resource" } });
  if (databaseCode === "P2025") return response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "The requested record was not found" } });
  if (databaseCode === "P2034") return response.status(409).json({ success: false, error: { code: "TRANSACTION_CONFLICT", message: "The operation conflicted with another request; retry safely" } });
  request.log?.error({ err: error }, "Unhandled request error");
  return response.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
