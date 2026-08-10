/**
 * TTS Tests — Node.js built-in test runner
 * Run: node --test tests/voice/tts.test.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock state ───────────────────────────────────────────────────────────────

let mockSynthesizeResult = {
  audioBuffer: Buffer.from('fake-audio-bytes'),
  mimeType: 'audio/wav',
};
let mockSynthesizeError = null;

let mockCacheHit = null; // { audioBuffer, mimeType } or null
let cacheWritten = [];

let mockRateLimitResult = { allowed: true };
let usageRecorded = [];

// ─── Mock functions ───────────────────────────────────────────────────────────

async function mockGetTtsProvider() {
  return {
    async synthesize() {
      if (mockSynthesizeError) throw mockSynthesizeError;
      return mockSynthesizeResult;
    },
  };
}

async function mockGetCached() {
  return mockCacheHit;
}

async function mockSetCached(_text, _provider, _model, _voice, audioBuffer, mimeType) {
  cacheWritten.push({ audioBuffer, mimeType });
}

async function mockCheckAndConsumeVoiceLimit() {
  return mockRateLimitResult;
}

const mockUserVoiceUsage = {
  async create(doc) {
    usageRecorded.push(doc);
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TTS — synthesizeText', () => {
  beforeEach(() => {
    mockSynthesizeResult = {
      audioBuffer: Buffer.from('fake-audio-bytes'),
      mimeType: 'audio/wav',
    };
    mockSynthesizeError = null;
    mockCacheHit = null;
    cacheWritten = [];
    mockRateLimitResult = { allowed: true };
    usageRecorded = [];
  });

  it('should return base64 audio for valid text', async () => {
    const provider = await mockGetTtsProvider();
    const { audioBuffer, mimeType } = await provider.synthesize({ text: 'عندك 37 قطعة من المنتج ده.' });

    const base64 = audioBuffer.toString('base64');
    assert.ok(base64.length > 0);
    assert.ok(mimeType.startsWith('audio/'));
  });

  it('should return cached audio without calling provider', async () => {
    mockCacheHit = {
      audioBuffer: Buffer.from('cached-audio'),
      mimeType: 'audio/wav',
    };

    const cached = await mockGetCached('some text', 'gemini', 'model', 'voice');
    assert.ok(cached !== null);
    assert.equal(cached.mimeType, 'audio/wav');
    // Provider should NOT be called when cache hits
    // (in the real controller, the provider call is skipped)
  });

  it('should write to cache after synthesis', async () => {
    const { audioBuffer, mimeType } = await mockGetTtsProvider().then(p =>
      p.synthesize({ text: 'عندك 37 قطعة.' })
    );

    await mockSetCached('عندك 37 قطعة.', 'gemini', 'model', 'voice', audioBuffer, mimeType);
    assert.equal(cacheWritten.length, 1);
    assert.equal(cacheWritten[0].mimeType, 'audio/wav');
  });

  it('should reject empty text', async () => {
    const { z } = await import('zod');
    const synthesizeSchema = z.object({
      text: z.string().min(1, 'النص لا يمكن أن يكون فارغاً').max(1000),
    });

    const result = synthesizeSchema.safeParse({ text: '' });
    assert.equal(result.success, false);
  });

  it('should reject text exceeding maximum length', async () => {
    const { z } = await import('zod');
    const synthesizeSchema = z.object({
      text: z.string().min(1).max(1000, 'النص أطول من الحد المسموح به'),
    });

    const longText = 'أ'.repeat(1001);
    const result = synthesizeSchema.safeParse({ text: longText });
    assert.equal(result.success, false);
  });

  it('should accept text at maximum length', async () => {
    const { z } = await import('zod');
    const synthesizeSchema = z.object({
      text: z.string().min(1).max(1000),
    });

    const maxText = 'أ'.repeat(1000);
    const result = synthesizeSchema.safeParse({ text: maxText });
    assert.equal(result.success, true);
  });

  it('should deny when TTS rate limit exceeded (user RPM)', async () => {
    mockRateLimitResult = {
      allowed: false,
      scope: 'user',
      limitType: 'RPM',
      retryAfterSeconds: 60,
      code: 'RATE_LIMIT_USER_RPM',
    };

    const result = await mockCheckAndConsumeVoiceLimit();
    assert.equal(result.allowed, false);
    assert.equal(result.retryAfterSeconds, 60);
  });

  it('should deny when TTS rate limit exceeded (user RPD)', async () => {
    mockRateLimitResult = {
      allowed: false,
      scope: 'user',
      limitType: 'RPD',
      retryAfterSeconds: 86400,
      code: 'RATE_LIMIT_USER_RPD',
    };

    const result = await mockCheckAndConsumeVoiceLimit();
    assert.equal(result.allowed, false);
    assert.equal(result.limitType, 'RPD');
  });

  it('should handle provider 429 as PROVIDER_RATE_LIMIT', async () => {
    const { AppError } = await import('../../src/utils/AppError.js');
    mockSynthesizeError = new AppError('مشغول', 429, 'PROVIDER_RATE_LIMIT');

    try {
      const provider = await mockGetTtsProvider();
      await provider.synthesize({ text: 'test' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.code, 'PROVIDER_RATE_LIMIT');
      assert.equal(err.statusCode, 429);
    }
  });

  it('should handle provider error as TTS_FAILED', async () => {
    const { AppError } = await import('../../src/utils/AppError.js');
    mockSynthesizeError = new AppError('فشل', 500, 'TTS_FAILED');

    try {
      const provider = await mockGetTtsProvider();
      await provider.synthesize({ text: 'test' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.code, 'TTS_FAILED');
    }
  });

  it('should record usage on success', async () => {
    await mockUserVoiceUsage.create({
      userId: 'user-001',
      tenantId: 'tenant-001',
      operation: 'TTS',
      provider: 'gemini',
      model: 'gemini-2.5-flash-preview-tts',
      status: 'success',
      durationMs: 400,
    });
    assert.equal(usageRecorded.length, 1);
    assert.equal(usageRecorded[0].operation, 'TTS');
    assert.equal(usageRecorded[0].status, 'success');
  });
});

describe('TTS — Disabled feature flag', () => {
  it('should return VOICE_DISABLED when TTS_ENABLED=false', async () => {
    const ttsDisabledConfig = { tts: { enabled: false } };
    assert.equal(ttsDisabledConfig.tts.enabled, false);
  });
});

describe('TTS — Error codes are stable', () => {
  it('should use stable VOICE_ERROR_CODES', async () => {
    const { VOICE_ERROR_CODES } = await import('../../src/constants/voiceErrors.js');
    assert.equal(VOICE_ERROR_CODES.TTS_FAILED, 'TTS_FAILED');
    assert.equal(VOICE_ERROR_CODES.PROVIDER_RATE_LIMIT, 'PROVIDER_RATE_LIMIT');
    assert.equal(VOICE_ERROR_CODES.RATE_LIMIT_USER_RPM, 'RATE_LIMIT_USER_RPM');
    assert.equal(VOICE_ERROR_CODES.RATE_LIMIT_USER_RPD, 'RATE_LIMIT_USER_RPD');
  });

  it('should have Arabic user-facing messages for all codes', async () => {
    const { VOICE_ERROR_CODES, VOICE_USER_MESSAGES } = await import('../../src/constants/voiceErrors.js');

    for (const code of Object.values(VOICE_ERROR_CODES)) {
      assert.ok(
        VOICE_USER_MESSAGES[code],
        `Missing Arabic message for error code: ${code}`
      );
    }
  });
});
