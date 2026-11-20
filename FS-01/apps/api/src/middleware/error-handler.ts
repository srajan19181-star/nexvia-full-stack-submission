import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export function notFoundHandler(): RequestHandler {
  return (request, _response, next): void => {
    next(
      new AppError({
        statusCode: 404,
        code: "ROUTE_NOT_FOUND",
        message: `No route matches ${request.method} ${request.path}`,
      }),
    );
  };
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, _next): void => {
    const requestId = response.locals.requestId as string | undefined;

    if (error instanceof ZodError) {
      response.status(422).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
          requestId,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error({ error, requestId, method: request.method, path: request.path }, "Request failed");
      }

      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.expose ? error.message : "An unexpected error occurred",
          ...(error.details === undefined ? {} : { details: error.details }),
          ...(requestId === undefined ? {} : { requestId }),
        },
      });
      return;
    }

    logger.error({ error, requestId, method: request.method, path: request.path }, "Unhandled request error");
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        ...(requestId === undefined ? {} : { requestId }),
      },
    });
  };
}
