export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(options: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
    expose?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? true;
  }
}

export function unauthorized(message = "Authentication required"): AppError {
  return new AppError({ statusCode: 401, code: "UNAUTHORIZED", message });
}

export function forbidden(message = "You do not have permission to perform this action"): AppError {
  return new AppError({ statusCode: 403, code: "FORBIDDEN", message });
}

export function notFound(message = "The requested resource was not found"): AppError {
  return new AppError({ statusCode: 404, code: "NOT_FOUND", message });
}

export function conflict(message: string, code = "CONFLICT"): AppError {
  return new AppError({ statusCode: 409, code, message });
}
