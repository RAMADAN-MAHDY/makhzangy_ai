import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { TenantUsage } from '../models/TenantUsage.js';
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
    const customerId = req.query.customerId;
    const targetUserId = req.query.userId;

    if (!tenantId) {
      return next(new AppError('tenantId is required', 400, 'INVALID_INPUT'));
    }

    const searchIds = Array.from(new Set([tenantId, customerId, targetUserId].filter(Boolean)));

    // 1. Try fast O(1) TenantUsage counter lookup
    const tenantRecord = await TenantUsage.findOne({ tenantId: { $in: searchIds } }).lean();

    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (tenantRecord && (tenantRecord.totalTokens > 0 || tenantRecord.totalRequests > 0)) {
      const recent = tenantRecord.recentRequests || [];
      const minute = recent.filter((r) => new Date(r.timestamp) >= oneMinAgo).length;
      const hour = recent.filter((r) => new Date(r.timestamp) >= oneHourAgo).length;
      const day = recent.filter((r) => new Date(r.timestamp) >= oneDayAgo).length;
      const week = recent.filter((r) => new Date(r.timestamp) >= oneWeekAgo).length;
      const month = recent.filter((r) => new Date(r.timestamp) >= oneMonthAgo).length;

      return res.json({
        success: true,
        data: {
          totalTokens: tenantRecord.totalTokens || 0,
          promptTokens: tenantRecord.promptTokens || 0,
          completionTokens: tenantRecord.completionTokens || 0,
          requests: { minute, hour, day, week, month },
        },
      });
    }

    // 2. Fallback to Conversation & Message aggregation for legacy messages
    const orConditions = [
      { tenantId: tenantId },
      { userId: tenantId },
    ];
    if (customerId) orConditions.push({ tenantId: customerId }, { userId: customerId });
    if (targetUserId) orConditions.push({ tenantId: targetUserId }, { userId: targetUserId });

    const conversationIds = await Conversation.find({ $or: orConditions }).distinct('_id');

    if (!conversationIds.length) {
      return res.json({
        success: true,
        data: {
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          requests: { minute: 0, hour: 0, day: 0, week: 0, month: 0 },
        },
      });
    }

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

    // Backfill TenantUsage counter so subsequent calls are O(1)
    if (tokenStats.totalTokens > 0 || monthCount > 0) {
      void TenantUsage.updateOne(
        { tenantId },
        {
          $set: {
            totalTokens: tokenStats.totalTokens || 0,
            promptTokens: tokenStats.promptTokens || 0,
            completionTokens: tokenStats.completionTokens || 0,
            totalRequests: monthCount || 0,
          },
        },
        { upsert: true }
      );
    }

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

