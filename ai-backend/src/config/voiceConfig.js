import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { VOICE_ERROR_CODES } from '../constants/voiceErrors.js';
import { AppError } from '../utils/AppError.js';

/**
 * Default STT Prompt — can be overridden via STT_PROMPT env variable.
 * Tuned for Egyptian Arabic warehouse context.
 */
const DEFAULT_STT_PROMPT = `You are a speech transcription engine.

Transcribe the user's speech exactly and return only the transcript.

Important rules:
- Preserve Egyptian Arabic dialect.
- Do not translate Egyptian Arabic into Modern Standard Arabic.
- Preserve product names exactly as spoken whenever possible.
- Preserve numbers, quantities, codes, SKUs, brand names, and English words.
- Do not answer the user's question.
- Do not summarize.
- Do not explain.
- Do not add information.
- Do not rewrite the user's intent.
- Do not hallucinate missing words.
- Return plain text only.`;

/**
 * Supported audio MIME types for STT.
 */
export const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/opus',
  'audio/3gpp',
]);

/**
 * Centralized voice feature configuration.
 * Read once at startup; imported by providers, services, and controllers.
 */
export const voiceConfig = {
  stt: {
    enabled: env.STT_ENABLED,
    apiKey: env.STT_API_KEY || env.GEMINI_API_KEY,
    provider: env.STT_PROVIDER,
    model: env.STT_MODEL,
    prompt: env.STT_PROMPT || DEFAULT_STT_PROMPT,
    rpmLimit: env.STT_RPM_LIMIT,
    rpdLimit: env.STT_RPD_LIMIT,
    defaultUserRpm: env.DEFAULT_USER_STT_RPM_LIMIT,
    defaultUserRpd: env.DEFAULT_USER_STT_RPD_LIMIT,
  },
  tts: {
    enabled: env.TTS_ENABLED,
    apiKey: env.TTS_API_KEY || env.GEMINI_API_KEY,
    provider: env.TTS_PROVIDER,
    model: env.TTS_MODEL,
    voice: env.TTS_VOICE,
    rpmLimit: env.TTS_RPM_LIMIT,
    rpdLimit: env.TTS_RPD_LIMIT,
    defaultUserRpm: env.DEFAULT_USER_TTS_RPM_LIMIT,
    defaultUserRpd: env.DEFAULT_USER_TTS_RPD_LIMIT,
  },
  limits: {
    maxFileSizeBytes: env.VOICE_MAX_FILE_SIZE_MB * 1024 * 1024,
    maxFileSizeMb: env.VOICE_MAX_FILE_SIZE_MB,
    maxDurationSeconds: env.VOICE_MAX_DURATION_SECONDS,
  },
};

/**
 * Validate voice configuration at startup.
 * Does NOT crash the app if STT_ENABLED=false or TTS_ENABLED=false.
 * Logs warnings for missing optional config, throws for critical missing config.
 */
export function validateVoiceConfig() {
  const { stt, tts } = voiceConfig;

  if (stt.enabled) {
    if (!stt.apiKey) {
      throw new AppError(
        'STT_API_KEY (أو GEMINI_API_KEY) مطلوب عند تفعيل STT',
        500,
        VOICE_ERROR_CODES.INVALID_CONFIGURATION
      );
    }
    if (!stt.model) {
      throw new AppError(
        'STT_MODEL مطلوب عند تفعيل STT',
        500,
        VOICE_ERROR_CODES.INVALID_CONFIGURATION
      );
    }
    logger.info(
      { provider: stt.provider, model: stt.model, hasDedicatedKey: Boolean(env.STT_API_KEY) },
      '🎤 STT configured'
    );
  } else {
    logger.warn('🎤 STT is disabled (STT_ENABLED=false)');
  }

  if (tts.enabled) {
    if (!tts.apiKey) {
      throw new AppError(
        'TTS_API_KEY (أو GEMINI_API_KEY) مطلوب عند تفعيل TTS',
        500,
        VOICE_ERROR_CODES.INVALID_CONFIGURATION
      );
    }
    if (!tts.model) {
      throw new AppError(
        'TTS_MODEL مطلوب عند تفعيل TTS',
        500,
        VOICE_ERROR_CODES.INVALID_CONFIGURATION
      );
    }
    if (!tts.voice) {
      logger.warn('TTS_VOICE غير محدد — سيُستخدم الصوت الافتراضي للـ provider');
    }
    logger.info(
      { provider: tts.provider, model: tts.model, voice: tts.voice, hasDedicatedKey: Boolean(env.TTS_API_KEY) },
      '🔊 TTS configured'
    );
  } else {
    logger.warn('🔊 TTS is disabled (TTS_ENABLED=false)');
  }
}
