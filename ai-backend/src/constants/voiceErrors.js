/**
 * Stable error codes for all Voice (STT/TTS) errors.
 * Controllers and services throw AppError with these codes.
 * Never expose Provider names or internal details in codes.
 */
export const VOICE_ERROR_CODES = {
  // Feature flags
  VOICE_DISABLED: 'VOICE_DISABLED',

  // Input validation
  INVALID_AUDIO: 'INVALID_AUDIO',
  AUDIO_TOO_LARGE: 'AUDIO_TOO_LARGE',
  AUDIO_TOO_LONG: 'AUDIO_TOO_LONG',

  // User-level rate limits
  RATE_LIMIT_USER_RPM: 'RATE_LIMIT_USER_RPM',
  RATE_LIMIT_USER_RPD: 'RATE_LIMIT_USER_RPD',

  // Provider-level rate limits (system-wide)
  RATE_LIMIT_PROVIDER_RPM: 'RATE_LIMIT_PROVIDER_RPM',
  RATE_LIMIT_PROVIDER_RPD: 'RATE_LIMIT_PROVIDER_RPD',

  // Provider errors (abstracted, no Gemini details)
  PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',

  // Configuration
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',

  // Operation failures
  STT_FAILED: 'STT_FAILED',
  TTS_FAILED: 'TTS_FAILED',
};

/**
 * Arabic user-facing messages for each error code.
 * Never shown to end-users: RPM, RPD, Gemini, Provider, 429.
 */
export const VOICE_USER_MESSAGES = {
  [VOICE_ERROR_CODES.VOICE_DISABLED]: 'الخدمة الصوتية غير متاحة حالياً.',
  [VOICE_ERROR_CODES.INVALID_AUDIO]: 'الملف الصوتي غير صالح أو من نوع غير مدعوم.',
  [VOICE_ERROR_CODES.AUDIO_TOO_LARGE]: 'الملف الصوتي أكبر من الحجم المسموح به.',
  [VOICE_ERROR_CODES.AUDIO_TOO_LONG]: 'مدة التسجيل أطول من المسموح به.',
  [VOICE_ERROR_CODES.RATE_LIMIT_USER_RPM]: 'لقد وصلت للحد المسموح من الطلبات حاليًا. حاول مرة أخرى بعد قليل.',
  [VOICE_ERROR_CODES.RATE_LIMIT_USER_RPD]: 'لقد وصلت للحد المجاني المسموح لك اليوم. حاول مرة أخرى غدًا.',
  [VOICE_ERROR_CODES.RATE_LIMIT_PROVIDER_RPM]: 'الخدمة الصوتية مشغولة حاليًا. حاول مرة أخرى بعد قليل.',
  [VOICE_ERROR_CODES.RATE_LIMIT_PROVIDER_RPD]: 'الخدمة الصوتية وصلت لحدها اليومي. حاول مرة أخرى غدًا.',
  [VOICE_ERROR_CODES.PROVIDER_RATE_LIMIT]: 'الخدمة الصوتية مشغولة حاليًا. حاول مرة أخرى بعد قليل.',
  [VOICE_ERROR_CODES.PROVIDER_UNAVAILABLE]: 'الخدمة الصوتية غير متاحة حالياً. حاول مرة أخرى بعد قليل.',
  [VOICE_ERROR_CODES.INVALID_CONFIGURATION]: 'الخدمة الصوتية غير مُهيَّأة بشكل صحيح.',
  [VOICE_ERROR_CODES.STT_FAILED]: 'تعذّر تحويل الصوت إلى نص. حاول مرة أخرى.',
  [VOICE_ERROR_CODES.TTS_FAILED]: 'تعذّر تحويل النص إلى صوت. حاول مرة أخرى.',
};
