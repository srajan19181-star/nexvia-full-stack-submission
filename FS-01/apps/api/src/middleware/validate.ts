import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    request.body = schema.parse(request.body);
    next();
  };
}

export function validateParams(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    request.params = schema.parse(request.params) as Request["params"];
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (request: Request, response: Response, next: NextFunction): void => {
    response.locals.validatedQuery = schema.parse(request.query);
    next();
  };
}
