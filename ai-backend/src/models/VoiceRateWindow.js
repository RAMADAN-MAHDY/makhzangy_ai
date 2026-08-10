import mongoose from 'mongoose';

/**
 * MongoDB-based sliding window rate limit counter.
 * Replaces Redis for Rate Limiting when Redis is not available.
 *
 * Key format examples:
 *   user:STT:rpm:{userId}:{tenantId}    → 1-minute window per user
 *   user:STT:rpd:{userId}:{tenantId}    → 24-hour window per user
 *   provider:STT:rpm                    → system-wide provider STT RPM
 *   provider:TTS:rpd                    → system-wide provider TTS RPD
 *
 * TTL index on `expiresAt` ensures MongoDB automatically cleans up expired windows.
 * This abstraction can be swapped for a Redis implementation in the future:
 *   - Replace incrementWindow() / getWindowCount() with ioredis INCR + EXPIRE
 */
const voiceRateWindowSchema = new mongoose.Schema(
  {
    /** Unique key identifying the window (scope + operation + granularity + identity) */
    key: { type: String, required: true, unique: true },

    /** Current count within this window */
    count: { type: Number, default: 0 },

    /** When this window expires (used by TTL index for auto-cleanup) */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: false }
);

export const VoiceRateWindow = mongoose.model('VoiceRateWindow', voiceRateWindowSchema);
