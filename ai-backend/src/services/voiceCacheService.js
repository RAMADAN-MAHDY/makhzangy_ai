import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * TTS Cache using MongoDB.
 *
 * Cache key = SHA-256(text + provider + model + voice)
 * Audio stored as base64 string in MongoDB with 24h TTL.
 *
 * Design note: this could be replaced with an S3 + Redis cache
 * for high-volume production. The interface stays the same.
 */

const ttsCacheSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, unique: true },
    /** base64-encoded audio buffer */
    audioBase64: { type: String, required: true },
    mimeType: { type: String, required: true },
    /** Used by TTL index — MongoDB deletes doc automatically */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: false }
);

// Lazy model registration (only create once)
const TtsCache =
  mongoose.models.TtsCache || mongoose.model('TtsCache', ttsCacheSchema);

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function buildHash(text, provider, model, voice) {
  return crypto
    .createHash('sha256')
    .update(`${text}|${provider}|${model}|${voice}`)
    .digest('hex');
}

/**
 * Check the cache for a previously synthesized audio.
 * @returns {Promise<{audioBuffer: Buffer, mimeType: string} | null>}
 */
export async function getCached(text, provider, model, voice) {
  try {
    const hash = buildHash(text, provider, model, voice);
    const doc = await TtsCache.findOne({ hash }).lean();

    if (!doc) return null;

    logger.debug({ hash }, 'voice.tts.cache_hit');
    return {
      audioBuffer: Buffer.from(doc.audioBase64, 'base64'),
      mimeType: doc.mimeType,
    };
  } catch (err) {
    // Cache miss on error — never block TTS for cache failures
    logger.warn({ err }, 'TTS cache read failed — bypassing cache');
    return null;
  }
}

/**
 * Store a synthesized audio response in the cache.
 * @param {string}  text
 * @param {string}  provider
 * @param {string}  model
 * @param {string}  voice
 * @param {Buffer}  audioBuffer
 * @param {string}  mimeType
 */
export async function setCached(text, provider, model, voice, audioBuffer, mimeType) {
  try {
    const hash = buildHash(text, provider, model, voice);
    const expiresAt = new Date(Date.now() + TTL_MS);

    await TtsCache.updateOne(
      { hash },
      { $set: { audioBase64: audioBuffer.toString('base64'), mimeType, expiresAt } },
      { upsert: true }
    );

    logger.debug({ hash }, 'voice.tts.cache_set');
  } catch (err) {
    // Never fail TTS because cache write failed
    logger.warn({ err }, 'TTS cache write failed — continuing without caching');
  }
}
