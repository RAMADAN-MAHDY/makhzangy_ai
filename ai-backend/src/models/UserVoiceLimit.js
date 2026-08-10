import mongoose from 'mongoose';

/**
 * Per-user voice rate limit overrides.
 * If a field is null, the system falls back to DEFAULT_USER_STT/TTS_RPM/RPD_LIMIT env vars.
 *
 * Examples:
 *   sttRpd = 5   → this user can do 5 STT requests per day
 *   sttRpd = null → use DEFAULT_USER_STT_RPD_LIMIT from env
 */
const userVoiceLimitSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },

    // STT limits (null = use env default)
    sttRpm: { type: Number, default: null },
    sttRpd: { type: Number, default: null },

    // TTS limits (null = use env default)
    ttsRpm: { type: Number, default: null },
    ttsRpd: { type: Number, default: null },
  },
  { timestamps: true }
);

// Composite unique: one limit doc per user per tenant
userVoiceLimitSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

export const UserVoiceLimit = mongoose.model('UserVoiceLimit', userVoiceLimitSchema);
