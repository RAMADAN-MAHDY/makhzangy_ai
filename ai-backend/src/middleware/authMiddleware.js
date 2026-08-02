import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Per architecture decision: "JWT Forwarding Authentication".
 * The AI Backend does NOT own the authorization model. It only:
 *   1) confirms the incoming JWT is well-formed (so we don't waste a
 *      Gemini call on an obviously unauthenticated request), and
 *   2) extracts userId/tenantId to scope Conversation/Message memory,
 *   3) forwards the RAW token untouched to the Main Backend on every
 *      tool call — the Main Backend remains the single source of truth
 *      for roles/permissions/subscription limits.
 */
export function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('غير مصرح لك، محتاج تسجل دخول', 401, 'UNAUTHORIZED'));
  }

  const token = header.slice('Bearer '.length);

  try {
    // We only decode/verify locally to read claims for memory scoping.
    // We never use this decoded payload to grant access to Main Backend data.
    const payload = jwt.verify(token, env.JWT_SECRET);

    req.userJwt = token;
    req.userId = payload.id || payload._id || payload.userId;
    req.tenantId = payload.tenantId || payload.tenant || payload.id;

    if (!req.userId) {
      return next(new AppError('توكن غير صالح', 401, 'INVALID_TOKEN'));
    }

    next();
  } catch (err) {
    next(new AppError('توكن غير صالح أو منتهي', 401, 'INVALID_TOKEN'));
  }
}
