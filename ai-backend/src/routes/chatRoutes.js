import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { chatMessageSchema } from '../constants/schemas.js';
import { sendMessage } from '../controllers/chatController.js';
import { listConversations, getConversationMessages } from '../controllers/conversationController.js';
import { getUsageSummary } from '../controllers/usageController.js';
import { superadminMiddleware } from '../middleware/superadminMiddleware.js';

const router = Router();

router.use(authMiddleware);

// Send a message (creates conversation automatically if needed)
router.post('/chat', validate(chatMessageSchema, 'body'), sendMessage);

// Conversations management
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', getConversationMessages);

// Usage summary (superadmin only)
router.get('/usage', superadminMiddleware, getUsageSummary);

export default router;
