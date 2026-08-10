import { voiceConfig } from '../../config/voiceConfig.js';
import { VOICE_ERROR_CODES } from '../../constants/voiceErrors.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Voice Provider Factory
 *
 * Returns the correct STT / TTS provider based on env configuration.
 * Business logic (controllers, services) NEVER imports providers directly.
 * They call getSttProvider() / getTtsProvider() and use the returned function.
 *
 * Adding a new provider (e.g. Deepgram, ElevenLabs) requires:
 *   1. Create src/providers/voice/deepgramSttProvider.js with transcribe()
 *   2. Add a case here for STT_PROVIDER=deepgram
 *   No other file needs to change.
 */

/**
 * Returns the active STT provider's transcribe function.
 * @returns {{ transcribe: Function }}
 */
export async function getSttProvider() {
  const { provider } = voiceConfig.stt;

  switch (provider) {
    case 'gemini': {
      const { transcribe } = await import('./geminiSttProvider.js');
      return { transcribe };
    }

    // Future providers:
    // case 'deepgram': {
    //   const { transcribe } = await import('./deepgramSttProvider.js');
    //   return { transcribe };
    // }

    default:
      throw new AppError(
        `STT provider غير مدعوم: ${provider}`,
        500,
        VOICE_ERROR_CODES.INVALID_CONFIGURATION
      );
  }
}

/**
 * Returns the active TTS provider's synthesize function.
 * @returns {{ synthesize: Function }}
 */
export async function getTtsProvider() {
  const { provider } = voiceConfig.tts;

  switch (provider) {
    case 'gemini': {
      const { synthesize } = await import('./geminiTtsProvider.js');
      return { synthesize };
    }

    // Future providers:
    // case 'elevenlabs': {
    //   const { synthesize } = await import('./elevenlabsTtsProvider.js');
    //   return { synthesize };
    // }

    default:
      throw new AppError(
        `TTS provider غير مدعوم: ${provider}`,
        500,
        VOICE_ERROR_CODES.INVALID_CONFIGURATION
      );
  }
}
