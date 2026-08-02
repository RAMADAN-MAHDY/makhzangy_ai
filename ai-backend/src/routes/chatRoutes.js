import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { chatMessageSchema } from '../constants/schemas.js';
import { sendMessage, getConversationMessages } from '../controllers/chatController.js';
import { getUsageSummary } from '../controllers/usageController.js';

const router = Router();

router.use(authMiddleware);

router.post('/chat', validate(chatMessageSchema, 'body'), sendMessage);
router.get('/conversations/:id/messages', getConversationMessages);
router.get('/usage', getUsageSummary);

export default router;
