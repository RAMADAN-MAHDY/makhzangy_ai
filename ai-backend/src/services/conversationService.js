import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';

export async function getOrCreateConversation({ conversationId, userId, tenantId }) {
  if (conversationId) {
    const existing = await Conversation.findOne({ _id: conversationId, userId, tenantId });
    if (existing) return existing;
  }

  return Conversation.create({ userId, tenantId });
}

export async function listUserConversations({ userId, tenantId }) {
  const conversations = await Conversation.find({ userId, tenantId })
    .sort({ lastActivityAt: -1 })
    .select('title summary lastActivityAt createdAt updatedAt')
    .lean();

  const conversationIds = conversations.map((conversation) => conversation._id);

  const counts = await Message.aggregate([
    { $match: { conversationId: { $in: conversationIds } } },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((item) => [String(item._id), item.count]));

  return conversations.map((conversation) => ({
    ...conversation,
    messageCount: countMap.get(String(conversation._id)) || 0,
  }));
}
