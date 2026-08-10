import { voiceConfig, SUPPORTED_AUDIO_MIME_TYPES } from '../config/voiceConfig.js';
import { getSttProvider, getTtsProvider } from '../providers/voice/voiceProviderFactory.js';
import { checkAndConsumeVoiceLimit } from '../services/voiceRateLimitService.js';
import { getCached, setCached } from '../services/voiceCacheService.js';
import { UserVoiceUsage } from '../models/UserVoiceUsage.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { VOICE_ERROR_CODES, VOICE_USER_MESSAGES } from '../constants/voiceErrors.js';

/**
 * Log voice usage to UserVoiceUsage (fire-and-forget, never blocks response).
 */
async function recordVoiceUsage({ userId, tenantId, operation, provider, model, durationMs, status, errorCode }) {
  try {
    await UserVoiceUsage.create({
      userId,
      tenantId,
      operation,
      provider,
      model,
      durationMs,
      status,
      ...(errorCode ? { errorCode } : {}),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to record voice usage');
  }
}

/**
 * Normalize a voice AppError to include retryAfterSeconds in the response
 * when it's a rate limit error (the extra field helps Frontend show a countdown).
 */
function buildVoiceErrorResponse(err) {
  const code = err.code || VOICE_ERROR_CODES.STT_FAILED;
  const message = VOICE_USER_MESSAGES[code] || err.message || 'حصل خطأ غير متوقع.';
  const extra = {};

  // Attach retryAfterSeconds for rate limit errors so Frontend can show a timer
  if (err.retryAfterSeconds) extra.retryAfterSeconds = err.retryAfterSeconds;
  if (err.meta?.retryAfterSeconds) extra.retryAfterSeconds = err.meta.retryAfterSeconds;

  return { code, message, ...extra };
}

// ─── STT Controller ──────────────────────────────────────────────────────────

/**
 * POST /api/voice/transcribe
 * Content-Type: multipart/form-data
 * Field: audio (file)
 *
 * Flow:
 *   Auth (via authMiddleware) → Validate Audio → Check Rate Limits
 *   → STT Provider → Return Transcript
 *
 * The returned transcript is plain text. The Frontend places it in the
 * chat input, user can edit it, then sends it to the existing /api/ai/chat.
 * Voice does NOT call the Chat pipeline internally.
 */
export async function transcribeAudio(req, res, next) {
  const startedAt = Date.now();
  const { userId, tenantId } = req;

  // Check STT enabled
  if (!voiceConfig.stt.enabled) {
    return next(
      new AppError(
        VOICE_USER_MESSAGES[VOICE_ERROR_CODES.VOICE_DISABLED],
        403,
        VOICE_ERROR_CODES.VOICE_DISABLED
      )
    );
  }

  logger.info({ userId, tenantId, provider: voiceConfig.stt.provider }, 'voice.stt.request');

  // ── 1. Validate uploaded file ─────────────────────────────────────────────
  if (!req.file) {
    return next(
      new AppError(
        VOICE_USER_MESSAGES[VOICE_ERROR_CODES.INVALID_AUDIO],
        400,
        VOICE_ERROR_CODES.INVALID_AUDIO
      )
    );
  }

  const { buffer: audioBuffer, mimetype, size } = req.file;

  // MIME type validation
  // Multer may report application/octet-stream for some audio types;
  // we also check the fieldname-provided mimeType or fall back to webm.
  const resolvedMime = SUPPORTED_AUDIO_MIME_TYPES.has(mimetype)
    ? mimetype
    : 'audio/webm'; // safe fallback for browser MediaRecorder output

  if (!SUPPORTED_AUDIO_MIME_TYPES.has(resolvedMime)) {
    return next(
      new AppError(
        VOICE_USER_MESSAGES[VOICE_ERROR_CODES.INVALID_AUDIO],
        400,
        VOICE_ERROR_CODES.INVALID_AUDIO
      )
    );
  }

  // File size validation (multer already limits, but double-check)
  if (size > voiceConfig.limits.maxFileSizeBytes) {
    return next(
      new AppError(
        VOICE_USER_MESSAGES[VOICE_ERROR_CODES.AUDIO_TOO_LARGE],
        413,
        VOICE_ERROR_CODES.AUDIO_TOO_LARGE
      )
    );
  }

  // ── 2. Rate limit check ───────────────────────────────────────────────────
  const rateLimitResult = await checkAndConsumeVoiceLimit(userId, tenantId, 'STT');

  if (!rateLimitResult.allowed) {
    void recordVoiceUsage({
      userId,
      tenantId,
      operation: 'STT',
      provider: voiceConfig.stt.provider,
      model: voiceConfig.stt.model,
      durationMs: Date.now() - startedAt,
      status: 'rate_limited',
      errorCode: rateLimitResult.code,
    });

    logger.warn({ userId, tenantId, ...rateLimitResult }, 'voice.stt.rate_limited');

    return res.status(429).json({
      success: false,
      error: buildVoiceErrorResponse({
        code: rateLimitResult.code,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      }),
    });
  }

  // ── 3. Call STT Provider ──────────────────────────────────────────────────
  try {
    const { transcribe } = await getSttProvider();

    const { text } = await transcribe({ audioBuffer, mimeType: resolvedMime });

    const durationMs = Date.now() - startedAt;

    void recordVoiceUsage({
      userId,
      tenantId,
      operation: 'STT',
      provider: voiceConfig.stt.provider,
      model: voiceConfig.stt.model,
      durationMs,
      status: 'success',
    });

    logger.info(
      {
        userId,
        tenantId,
        provider: voiceConfig.stt.provider,
        model: voiceConfig.stt.model,
        durationMs,
      },
      'voice.stt.success'
    );

    return res.json({ success: true, text });
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    void recordVoiceUsage({
      userId,
      tenantId,
      operation: 'STT',
      provider: voiceConfig.stt.provider,
      model: voiceConfig.stt.model,
      durationMs,
      status: 'error',
      errorCode: err.code || VOICE_ERROR_CODES.STT_FAILED,
    });

    logger.error(
      {
        userId,
        tenantId,
        provider: voiceConfig.stt.provider,
        model: voiceConfig.stt.model,
        durationMs,
        errorCode: err.code,
      },
      'voice.stt.error'
    );

    if (err.isOperational) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: buildVoiceErrorResponse(err),
      });
    }

    next(err);
  }
}

// ─── TTS Controller ───────────────────────────────────────────────────────────

/**
 * POST /api/voice/synthesize
 * Content-Type: application/json
 * Body: { text: string }
 *
 * Flow:
 *   Auth → Validate Text → Check Rate Limits → Cache Check
 *   → TTS Provider → Cache Write → Return Audio (base64)
 *
 * Returns audio as base64-encoded string so it can be played
 * directly by the Frontend without a separate download request.
 * Auto-play is NOT the Frontend's responsibility — user clicks 🔊.
 */
export async function synthesizeText(req, res, next) {
  const startedAt = Date.now();
  const { userId, tenantId } = req;
  const { text } = req.body;

  // Check TTS enabled
  if (!voiceConfig.tts.enabled) {
    return next(
      new AppError(
        VOICE_USER_MESSAGES[VOICE_ERROR_CODES.VOICE_DISABLED],
        403,
        VOICE_ERROR_CODES.VOICE_DISABLED
      )
    );
  }

  logger.info({ userId, tenantId, provider: voiceConfig.tts.provider }, 'voice.tts.request');

  // ── 1. Rate limit check ───────────────────────────────────────────────────
  const rateLimitResult = await checkAndConsumeVoiceLimit(userId, tenantId, 'TTS');

  if (!rateLimitResult.allowed) {
    void recordVoiceUsage({
      userId,
      tenantId,
      operation: 'TTS',
      provider: voiceConfig.tts.provider,
      model: voiceConfig.tts.model,
      durationMs: Date.now() - startedAt,
      status: 'rate_limited',
      errorCode: rateLimitResult.code,
    });

    logger.warn({ userId, tenantId, ...rateLimitResult }, 'voice.tts.rate_limited');

    return res.status(429).json({
      success: false,
      error: buildVoiceErrorResponse({
        code: rateLimitResult.code,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      }),
    });
  }

  // ── 2. Cache check — avoid TTS API call if already cached ────────────────
  const { provider, model, voice } = voiceConfig.tts;
  const cached = await getCached(text, provider, model, voice);

  if (cached) {
    const durationMs = Date.now() - startedAt;

    logger.info({ userId, tenantId, durationMs }, 'voice.tts.cache_hit');

    return res.json({
      success: true,
      audio: cached.audioBuffer.toString('base64'),
      mimeType: cached.mimeType,
      cached: true,
    });
  }

  // ── 3. Call TTS Provider ──────────────────────────────────────────────────
  try {
    const { synthesize } = await getTtsProvider();

    const { audioBuffer, mimeType } = await synthesize({ text });

    const durationMs = Date.now() - startedAt;

    // Write to cache (non-blocking)
    void setCached(text, provider, model, voice, audioBuffer, mimeType);

    void recordVoiceUsage({
      userId,
      tenantId,
      operation: 'TTS',
      provider,
      model,
      durationMs,
      status: 'success',
    });

    logger.info(
      { userId, tenantId, provider, model, durationMs },
      'voice.tts.success'
    );

    return res.json({
      success: true,
      audio: audioBuffer.toString('base64'),
      mimeType,
      cached: false,
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    void recordVoiceUsage({
      userId,
      tenantId,
      operation: 'TTS',
      provider,
      model,
      durationMs,
      status: 'error',
      errorCode: err.code || VOICE_ERROR_CODES.TTS_FAILED,
    });

    logger.error(
      {
        userId,
        tenantId,
        provider,
        model,
        durationMs,
        errorCode: err.code,
      },
      'voice.tts.error'
    );

    if (err.isOperational) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: buildVoiceErrorResponse(err),
      });
    }

    next(err);
  }
}
