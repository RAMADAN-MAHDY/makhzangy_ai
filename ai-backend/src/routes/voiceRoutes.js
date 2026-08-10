import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { synthesizeSchema } from '../constants/voiceSchemas.js';
import { transcribeAudio, synthesizeText } from '../controllers/voiceController.js';
import { voiceConfig } from '../config/voiceConfig.js';

const router = Router();

// All voice routes require authentication (same JWT as Chat)
router.use(authMiddleware);

// ─── Multer setup for audio upload ───────────────────────────────────────────
// Memory storage: we pass the buffer directly to the STT provider.
// No files are written to disk.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: voiceConfig.limits.maxFileSizeBytes,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    // Accept any audio/* MIME type; strict validation happens in the controller
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('INVALID_AUDIO'));
    }
  },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/voice/transcribe
 * Content-Type: multipart/form-data
 * Field: audio (audio file)
 *
 * Returns:
 *   { success: true, text: "كام قطعة من المنتج ده؟" }
 *
 * The returned text is displayed in the chat input so the user can
 * edit it before sending to /api/ai/chat. Nothing is sent automatically.
 */
router.post('/transcribe', audioUpload.single('audio'), transcribeAudio);

/**
 * POST /api/voice/synthesize
 * Content-Type: application/json
 * Body: { text: string }
 *
 * Returns:
 *   { success: true, audio: "<base64>", mimeType: "audio/wav", cached: false }
 *
 * Frontend decodes the base64 and plays it only when the user clicks 🔊.
 * Auto-play is NOT implemented.
 */
router.post('/synthesize', validate(synthesizeSchema, 'body'), synthesizeText);

export default router;
