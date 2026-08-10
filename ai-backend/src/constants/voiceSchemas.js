import { z } from 'zod';

/**
 * Zod schema for POST /api/voice/synthesize
 * STT uses multipart/form-data so no Zod body schema needed there.
 */
export const synthesizeSchema = z.object({
  text: z
    .string()
    .min(1, 'النص لا يمكن أن يكون فارغاً')
    .max(1000, 'النص أطول من الحد المسموح به (1000 حرف)'),
});
