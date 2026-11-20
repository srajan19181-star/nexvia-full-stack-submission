import type { Request } from "express";
import { AppError } from "./errors.js";

export function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ROUTE_PARAMETER",
      message: `Route parameter ${name} is invalid`,
    });
  }
  return value;
}
