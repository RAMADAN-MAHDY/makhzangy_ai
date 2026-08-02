/**
 * Unified operational error class.
 * Thrown anywhere in the app (controllers, tools, providers) and caught
 * by the global error middleware, matching the Main Backend's convention.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
