import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const incomingRequestId = request.get("x-request-id");
  const requestId = incomingRequestId && incomingRequestId.length <= 128 ? incomingRequestId : randomUUID();
  response.locals.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}
