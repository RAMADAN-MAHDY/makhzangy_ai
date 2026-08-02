import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';
import { listUserConversations } from '../services/conversationService.js';

export async function listConversations(req, res, next) {
  try {
    const conversations = await listUserConversations({ userId: req.userId, tenantId: req.tenantId });

    res.json({ success: true, data: { conversations } });
  } catch (err) {
    next(err);
  }
}

export async function getConversationMessages(req, res, next) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.userId,
      tenantId: req.tenantId,
    });

    if (!conversation) {
      throw new AppError('المحادثة غير موجودة', 404, 'CONVERSATION_NOT_FOUND');
    }

    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });

    res.json({ success: true, data: { conversation, messages } });
  } catch (err) {
    next(err);
  }
}
