import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next({ statusCode: 404, code: 'NOT_FOUND', message: `Route not found: ${req.originalUrl}` });
}

export function errorMiddleware(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  } else {
    logger.warn({ code, path: req.originalUrl, message: err.message }, 'Handled error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'حصل خطأ غير متوقع',
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
}
