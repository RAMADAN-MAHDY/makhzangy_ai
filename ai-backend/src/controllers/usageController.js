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

export async function getUserUsageDetails(req, res, next) {
  try {
    const tenantId = req.params.tenantId || req.query.tenantId || req.tenantId;

    if (!tenantId) {
      return next(new AppError('tenantId is required', 400, 'INVALID_INPUT'));
    }

    const conversationIds = await Conversation.find({
      $or: [{ tenantId }, { userId: tenantId }],
    }).distinct('_id');

    if (!conversationIds.length) {
      return res.json({
        success: true,
        data: {
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          requests: {
            minute: 0,
            hour: 0,
            day: 0,
            week: 0,
            month: 0,
          },
        },
      });
    }

    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const tokenAgg = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          role: 'assistant',
          'tokenUsage.totalTokens': { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
          promptTokens: { $sum: '$tokenUsage.promptTokens' },
          completionTokens: { $sum: '$tokenUsage.completionTokens' },
        },
      },
    ]);

    const tokenStats = tokenAgg[0] || { totalTokens: 0, promptTokens: 0, completionTokens: 0 };

    const [minuteCount, hourCount, dayCount, weekCount, monthCount] = await Promise.all([
      Message.countDocuments({ conversationId: { $in: conversationIds }, role: 'user', createdAt: { $gte: oneMinAgo } }),
      Message.countDocuments({ conversationId: { $in: conversationIds }, role: 'user', createdAt: { $gte: oneHourAgo } }),
      Message.countDocuments({ conversationId: { $in: conversationIds }, role: 'user', createdAt: { $gte: oneDayAgo } }),
      Message.countDocuments({ conversationId: { $in: conversationIds }, role: 'user', createdAt: { $gte: oneWeekAgo } }),
      Message.countDocuments({ conversationId: { $in: conversationIds }, role: 'user', createdAt: { $gte: oneMonthAgo } }),
    ]);

    res.json({
      success: true,
      data: {
        totalTokens: tokenStats.totalTokens || 0,
        promptTokens: tokenStats.promptTokens || 0,
        completionTokens: tokenStats.completionTokens || 0,
        requests: {
          minute: minuteCount,
          hour: hourCount,
          day: dayCount,
          week: weekCount,
          month: monthCount,
        },
      },
    });
  } catch (err) {
    next(new AppError(err.message || 'Failed to fetch user AI usage details', 500, 'USER_AI_USAGE_ERROR'));
  }
}

