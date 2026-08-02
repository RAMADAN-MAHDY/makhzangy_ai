import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';

export async function getUsageSummary(req, res, next) {
  try {
    const { from, to } = req.query;
    const { userId, tenantId } = req;

    const conversationIds = await Conversation.find({ userId, tenantId }).distinct('_id');

    if (!conversationIds.length) {
      return res.json({ success: true, data: { totalTokens: 0, promptTokens: 0, completionTokens: 0, messageCount: 0 } });
    }

    const match = {
      conversationId: { $in: conversationIds },
      role: 'assistant',
      'tokenUsage.totalTokens': { $exists: true },
    };

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const usage = await Message.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
          promptTokens: { $sum: '$tokenUsage.promptTokens' },
          completionTokens: { $sum: '$tokenUsage.completionTokens' },
          messageCount: { $sum: 1 },
        },
      },
    ]);

    const result = usage[0] || { totalTokens: 0, promptTokens: 0, completionTokens: 0, messageCount: 0 };

    res.json({ success: true, data: result });
  } catch (err) {
    next(new AppError(err.message || 'Failed to compute usage summary', 500, 'USAGE_SUMMARY_ERROR'));
  }
}
