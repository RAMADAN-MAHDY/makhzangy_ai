import 'dotenv/config';
import { z } from 'zod';

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v !== 'false' && v !== '0')
  .default('true');

const envSchema = z.object({
  PORT: z.coerce.number().default(5100),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  MAIN_BACKEND_BASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),

  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),

  LOG_LEVEL: z.string().default('info'),

  // ─── Voice / STT ────────────────────────────────────────────────────────────
  STT_ENABLED: boolFromString,
  STT_API_KEY: z.string().optional(),
  STT_PROVIDER: z.string().default('gemini'),
  STT_MODEL: z.string().default('gemini-2.5-flash'),
  /** Optional: override the built-in STT prompt via env */
  STT_PROMPT: z.string().optional(),

  // Provider-level rate limits (system-wide)
  STT_RPM_LIMIT: z.coerce.number().default(5),
  STT_RPD_LIMIT: z.coerce.number().default(20),

  // Per-user default limits (used when UserVoiceLimit.sttRpm/sttRpd is null)
  DEFAULT_USER_STT_RPM_LIMIT: z.coerce.number().default(3),
  DEFAULT_USER_STT_RPD_LIMIT: z.coerce.number().default(10),

  // ─── Voice / TTS ────────────────────────────────────────────────────────────
  TTS_ENABLED: boolFromString,
  TTS_API_KEY: z.string().optional(),
  TTS_PROVIDER: z.string().default('gemini'),
  TTS_MODEL: z.string().default('gemini-1.5-flash'),
  TTS_VOICE: z.string().default('Aoede'),

  // Provider-level rate limits
  TTS_RPM_LIMIT: z.coerce.number().default(3),
  TTS_RPD_LIMIT: z.coerce.number().default(10),

  // Per-user default limits
  DEFAULT_USER_TTS_RPM_LIMIT: z.coerce.number().default(2),
  DEFAULT_USER_TTS_RPD_LIMIT: z.coerce.number().default(5),

  // ─── Voice file constraints ──────────────────────────────────────────────────
  VOICE_MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  VOICE_MAX_DURATION_SECONDS: z.coerce.number().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable error instead of crashing deep in the app.
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
