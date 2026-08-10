import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { voiceConfig } from '../../config/voiceConfig.js';
import { VOICE_ERROR_CODES } from '../../constants/voiceErrors.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

function getClient() {
  return new GoogleGenAI({ apiKey: voiceConfig.stt.apiKey });
}

/**
 * Detect whether a Gemini error is a provider-level 429.
 * Returns { is429: boolean, retryAfterSeconds: number }
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

  // Try to extract Retry-After from the error
  const retryMatch = rawMessage.match(/"retryDelay"\s*:\s*"?(\d+)/);
  const retryAfterSeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;

  return { is429: true, retryAfterSeconds };
}

/**
 * Gemini STT Provider
 *
 * Contract: transcribe({ audioBuffer, mimeType }) → { text: string }
 *
 * Uses Gemini's multimodal audio input to transcribe audio.
 * The prompt instructs the model to transcribe only — not answer questions.
 * This provider does NOT know about rate limiting, users, or tenants.
 * Those concerns live in voiceRateLimitService and voiceController.
 *
 * @param {{ audioBuffer: Buffer, mimeType: string }} input
 * @returns {Promise<{ text: string }>}
 */
export async function transcribe({ audioBuffer, mimeType }) {
  const { model, prompt } = voiceConfig.stt;

  const audioBase64 = audioBuffer.toString('base64');

  let response;
  try {
    const client = getClient();
    response = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });
  } catch (err) {
    const { is429, retryAfterSeconds } = parseProviderRateLimit(err);

    if (is429) {
      // Log internally — never expose provider details to user
      logger.warn(
        { provider: 'gemini', model, retryAfterSeconds },
        'voice.stt.provider_rate_limit'
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
      logger.error({ provider: 'gemini', model, err }, 'voice.stt.provider_unavailable');
      throw new AppError(
        'الخدمة الصوتية غير متاحة حالياً. حاول مرة أخرى بعد قليل.',
        503,
        VOICE_ERROR_CODES.PROVIDER_UNAVAILABLE
      );
    }

    logger.error({ provider: 'gemini', model, err }, 'voice.stt.provider_error');
    throw new AppError(
      'تعذّر تحويل الصوت إلى نص. حاول مرة أخرى.',
      500,
      VOICE_ERROR_CODES.STT_FAILED
    );
  }

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) {
    logger.warn({ model }, 'voice.stt.empty_transcript');
    throw new AppError(
      'لم يتم التعرّف على صوت واضح. يرجى التحدث بصوت أعلى وإعادة المحاولة.',
      400,
      VOICE_ERROR_CODES.INVALID_AUDIO
    );
  }

  return { text };
}
