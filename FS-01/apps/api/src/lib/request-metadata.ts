import type { Request } from "express";
import type { RequestMetadata } from "../services/auth.service.js";

export function getRequestMetadata(request: Request): RequestMetadata {
  const ipAddress = request.ip;
  const userAgent = request.get("user-agent");
  return {
    ...(ipAddress === undefined ? {} : { ipAddress }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}
