import { UserVoiceLimit } from '../models/UserVoiceLimit.js';
import { VoiceRateWindow } from '../models/VoiceRateWindow.js';
import { voiceConfig } from '../config/voiceConfig.js';
import { VOICE_ERROR_CODES } from '../constants/voiceErrors.js';
import { logger } from '../utils/logger.js';

/**
 * Rate Limit Check Result shape:
 * {
 *   allowed: boolean,
 *   scope: 'user' | 'provider',
 *   limitType: 'RPM' | 'RPD',
 *   retryAfterSeconds: number,
 *   code: string,   // VOICE_ERROR_CODES constant
 *   message: string
 * }
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Increment a rate window counter atomically.
 * Returns the new count after increment.
 * Creates the window document if it doesn't exist yet.
 *
 * @param {string} key     - Unique window key
 * @param {number} ttlMs   - Window duration in milliseconds
 * @returns {Promise<number>} Current count in the window
 */
async function incrementWindow(key, ttlMs) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const doc = await VoiceRateWindow.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt },
    },
    { upsert: true, new: true }
  );

  return doc.count;
}

/**
 * Read the current count for a window without incrementing.
 * Returns 0 if the window doesn't exist.
 */
async function getWindowCount(key) {
  const doc = await VoiceRateWindow.findOne({ key }).lean();
  return doc?.count ?? 0;
}

/**
 * Build rate window keys for user-scoped limits.
 */
function userWindowKeys(userId, tenantId, operation) {
  const base = `user:${operation}:${tenantId}:${userId}`;
  return {
    rpm: `${base}:rpm`,
    rpd: `${base}:rpd`,
  };
}

/**
 * Build rate window keys for system-wide provider limits.
 */
function providerWindowKeys(operation) {
  return {
    rpm: `provider:${operation}:rpm`,
    rpd: `provider:${operation}:rpd`,
  };
}

/**
 * Fetch user's effective limits, falling back to env defaults when null.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {'STT'|'TTS'} operation
 * @returns {Promise<{rpm: number, rpd: number}>}
 */
async function getUserEffectiveLimits(userId, tenantId, operation) {
  const limitDoc = await UserVoiceLimit.findOne({ userId, tenantId }).lean();

  if (operation === 'STT') {
    return {
      rpm: limitDoc?.sttRpm ?? voiceConfig.stt.defaultUserRpm,
      rpd: limitDoc?.sttRpd ?? voiceConfig.stt.defaultUserRpd,
    };
  }

  return {
    rpm: limitDoc?.ttsRpm ?? voiceConfig.tts.defaultUserRpm,
    rpd: limitDoc?.ttsRpd ?? voiceConfig.tts.defaultUserRpd,
  };
}

/**
 * Check user-level rate limits WITHOUT incrementing.
 * Used to pre-flight before calling the provider.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {'STT'|'TTS'} operation
 * @returns {Promise<{allowed: boolean, ...}>}
 */
async function checkUserLimit(userId, tenantId, operation) {
  const { rpm: rpmLimit, rpd: rpdLimit } = await getUserEffectiveLimits(
    userId,
    tenantId,
    operation
  );

  const keys = userWindowKeys(userId, tenantId, operation);

  const [rpmCount, rpdCount] = await Promise.all([
    getWindowCount(keys.rpm),
    getWindowCount(keys.rpd),
  ]);

  if (rpmCount >= rpmLimit) {
    return {
      allowed: false,
      scope: 'user',
      limitType: 'RPM',
      retryAfterSeconds: 60,
      code:
        operation === 'STT'
          ? VOICE_ERROR_CODES.RATE_LIMIT_USER_RPM
          : VOICE_ERROR_CODES.RATE_LIMIT_USER_RPM,
    };
  }

  if (rpdCount >= rpdLimit) {
    return {
      allowed: false,
      scope: 'user',
      limitType: 'RPD',
      retryAfterSeconds: 86400,
      code: VOICE_ERROR_CODES.RATE_LIMIT_USER_RPD,
    };
  }

  return { allowed: true, scope: 'user' };
}

/**
 * Check provider-level rate limits WITHOUT incrementing.
 *
 * @param {'STT'|'TTS'} operation
 * @returns {Promise<{allowed: boolean, ...}>}
 */
async function checkProviderLimit(operation) {
  const cfg = operation === 'STT' ? voiceConfig.stt : voiceConfig.tts;
  const keys = providerWindowKeys(operation);

  const [rpmCount, rpdCount] = await Promise.all([
    getWindowCount(keys.rpm),
    getWindowCount(keys.rpd),
  ]);

  if (rpmCount >= cfg.rpmLimit) {
    return {
      allowed: false,
      scope: 'provider',
      limitType: 'RPM',
      retryAfterSeconds: 60,
      code:
        operation === 'STT'
          ? VOICE_ERROR_CODES.RATE_LIMIT_PROVIDER_RPM
          : VOICE_ERROR_CODES.RATE_LIMIT_PROVIDER_RPM,
    };
  }

  if (rpdCount >= cfg.rpdLimit) {
    return {
      allowed: false,
      scope: 'provider',
      limitType: 'RPD',
      retryAfterSeconds: 86400,
      code: VOICE_ERROR_CODES.RATE_LIMIT_PROVIDER_RPD,
    };
  }

  return { allowed: true, scope: 'provider' };
}

/**
 * Increment both RPM and RPD windows for a user after a successful check.
 * Call this only AFTER the rate limit check passes.
 */
async function consumeUserLimit(userId, tenantId, operation) {
  const keys = userWindowKeys(userId, tenantId, operation);
  await Promise.all([
    incrementWindow(keys.rpm, MINUTE_MS),
    incrementWindow(keys.rpd, DAY_MS),
  ]);
}

/**
 * Increment both RPM and RPD windows for the provider.
 * Call this only AFTER the rate limit check passes.
 */
async function consumeProviderLimit(operation) {
  const keys = providerWindowKeys(operation);
  await Promise.all([
    incrementWindow(keys.rpm, MINUTE_MS),
    incrementWindow(keys.rpd, DAY_MS),
  ]);
}

/**
 * Full rate limit gate: User limit → Provider limit.
 * Checks both levels. If allowed, also CONSUMES (increments) both.
 * Returns the first denial found, or {allowed: true} if everything passes.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {'STT'|'TTS'} operation
 * @returns {Promise<{allowed: boolean, scope?: string, limitType?: string, retryAfterSeconds?: number, code?: string}>}
 */
export async function checkAndConsumeVoiceLimit(userId, tenantId, operation) {
  try {
    // Level 1: User limits
    const userCheck = await checkUserLimit(userId, tenantId, operation);
    if (!userCheck.allowed) {
      logger.warn({ userId, tenantId, operation, ...userCheck }, 'voice.rate_limit.user');
      return userCheck;
    }

    // Level 2: Provider limits
    const providerCheck = await checkProviderLimit(operation);
    if (!providerCheck.allowed) {
      logger.warn({ operation, ...providerCheck }, 'voice.rate_limit.provider');
      return providerCheck;
    }

    // Both pass — consume tokens
    await Promise.all([
      consumeUserLimit(userId, tenantId, operation),
      consumeProviderLimit(operation),
    ]);

    return { allowed: true };
  } catch (err) {
    // Never block a request because of a rate-limit-store failure
    logger.error({ err, userId, tenantId, operation }, 'voice.rate_limit.check_failed — allowing request');
    return { allowed: true };
  }
}
