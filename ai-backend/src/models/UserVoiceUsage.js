import mongoose from 'mongoose';

/**
 * Records every STT/TTS operation for audit and analytics.
 * Does NOT store the audio itself or sensitive text content.
 * Documents expire after 90 days via TTL index.
 */
const userVoiceUsageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },

    /** 'STT' | 'TTS' */
    operation: { type: String, enum: ['STT', 'TTS'], required: true },

    provider: { type: String, required: true },
    model: { type: String, required: true },

    /** Operation wall-clock time in milliseconds */
    durationMs: { type: Number },

    /** 'success' | 'error' | 'rate_limited' */
    status: {
      type: String,
      enum: ['success', 'error', 'rate_limited'],
      required: true,
    },

    /** Stable error code from voiceErrors.js (only when status !== 'success') */
    errorCode: { type: String },
  },
  { timestamps: true }
);

userVoiceUsageSchema.index({ userId: 1, tenantId: 1, createdAt: -1 });

// Auto-delete after 90 days
userVoiceUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const UserVoiceUsage = mongoose.model('UserVoiceUsage', userVoiceUsageSchema);
