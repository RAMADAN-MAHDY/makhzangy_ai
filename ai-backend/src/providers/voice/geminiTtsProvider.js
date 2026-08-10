import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { voiceConfig } from '../../config/voiceConfig.js';
import { VOICE_ERROR_CODES } from '../../constants/voiceErrors.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

function getClient() {
  return new GoogleGenAI({ apiKey: voiceConfig.tts.apiKey });
}

/**
 * Detect whether a Gemini error is a provider-level 429.
 */
function parseProviderRateLimit(err) {
  const rawMessage = typeof err?.message === 'string' ? err.message : JSON.stringify(err || {});
  const status = err?.status || err?.statusCode || err?.code || err?.error?.code || err?.response?.status;

  const is429 =
    status === 429 ||
    rawMessage.includes('"code":429') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.toLowerCase().includes('quota') ||
    rawMessage.toLowerCase().includes('rate limit');

  if (!is429) return { is429: false, retryAfterSeconds: 0 };

  const retryMatch = rawMessage.match(/"retryDelay"\s*:\s*"?(\d+)/);
  const retryAfterSeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;

  return { is429: true, retryAfterSeconds };
}

/**
 * Gemini TTS Provider — completely separate from STT provider.
 *
 * Contract: synthesize({ text }) → { audioBuffer: Buffer, mimeType: string }
 *
 * Uses Gemini 2.5 Flash TTS API.
 * Voice name comes from env (TTS_VOICE) — never hard-coded.
 * This provider does NOT know about caching, rate limiting, users, or tenants.
 *
 * @param {{ text: string }} input
 * @returns {Promise<{ audioBuffer: Buffer, mimeType: string }>}
 */
export async function synthesize({ text }) {
  const { model, voice } = voiceConfig.tts;

  let response;
  try {
    const client = getClient();
    response = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    });
  } catch (err) {
    const { is429, retryAfterSeconds } = parseProviderRateLimit(err);

    if (is429) {
      logger.warn(
        { provider: 'gemini', model, retryAfterSeconds },
        'voice.tts.provider_rate_limit'
      );
      throw new AppError(
        'الخدمة الصوتية مشغولة حاليًا. حاول مرة أخرى بعد قليل.',
        429,
        VOICE_ERROR_CODES.PROVIDER_RATE_LIMIT,
        { retryAfterSeconds }
      );
    }

    const rawMessage = typeof err?.message === 'string' ? err.message : '';
    const isUnavailable =
      err?.status === 503 ||
      rawMessage.includes('UNAVAILABLE') ||
      rawMessage.includes('"code":503');

    if (isUnavailable) {
      logger.error({ provider: 'gemini', model, err }, 'voice.tts.provider_unavailable');
      throw new AppError(
        'الخدمة الصوتية غير متاحة حالياً. حاول مرة أخرى بعد قليل.',
        503,
        VOICE_ERROR_CODES.PROVIDER_UNAVAILABLE
      );
    }

    logger.error({ provider: 'gemini', model, err }, 'voice.tts.provider_error');
    throw new AppError(
      'تعذّر تحويل النص إلى صوت. حاول مرة أخرى.',
      500,
      VOICE_ERROR_CODES.TTS_FAILED
    );
  }

  // Extract audio from the response
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const audioPart = parts.find((p) => p.inlineData?.mimeType?.startsWith('audio/'));

  if (!audioPart?.inlineData?.data) {
    logger.error({ model }, 'voice.tts.empty_audio_response');
    throw new AppError(
      'تعذّر تحويل النص إلى صوت. حاول مرة أخرى.',
      500,
      VOICE_ERROR_CODES.TTS_FAILED
    );
  }

  const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
  const mimeType = audioPart.inlineData.mimeType;

  return { audioBuffer, mimeType };
}
