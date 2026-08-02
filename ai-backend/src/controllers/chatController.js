import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { buildContext } from '../memory/contextBuilder.js';
import { maybeSummarize } from '../memory/summaryService.js';
import { runGeminiTurn } from '../providers/geminiProvider.js';
import { createMainBackendClient } from '../utils/mainBackendClient.js';
import { getActiveSystemPrompt } from '../registry/promptRegistry.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/ai/chat
 * body: { conversationId?: string, message: string }
 * headers: Authorization: Bearer <same JWT the user uses on the Main Backend>
 */
export async function sendMessage(req, res, next) {
  const startedAt = Date.now();

  try {
    const { conversationId, message } = req.body;
    const { userId, tenantId, userJwt } = req;

    const conversation = await getOrCreateConversation({ conversationId, userId, tenantId });

    await Message.create({ conversationId: conversation._id, role: 'user', content: message });

    const { systemPrompt, history } = await buildContext(conversation);
    const mainBackendClient = createMainBackendClient(userJwt);

    const { text, toolCalls, usage } = await runGeminiTurn({
      systemPrompt,
      history,
      userMessage: message,
      toolCtx: { mainBackendClient, userId, tenantId },
    });

    const { version: promptVersion } = getActiveSystemPrompt();

    await Message.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: text,
      toolCalls,
      promptVersion,
      tokenUsage: {
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount,
      },
    });

    conversation.lastActivityAt = new Date();
    await conversation.save();
    await maybeSummarize(conversation);

    logger.info(
      { conversationId: conversation._id, tenantId, latencyMs: Date.now() - startedAt, toolsUsed: toolCalls.map((t) => t.name) },
      'AI chat turn completed'
    );

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        reply: text,
        toolCalls: toolCalls.map(({ name, latencyMs, error }) => ({ name, latencyMs, error })),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/ai/conversations/:id/messages */
export async function getConversationMessages(req, res, next) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.userId,
      tenantId: req.tenantId,
    });

    if (!conversation) throw new AppError('المحادثة غير موجودة', 404, 'CONVERSATION_NOT_FOUND');

    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });

    res.json({ success: true, data: { conversation, messages } });
  } catch (err) {
    next(err);
  }
}

async function getOrCreateConversation({ conversationId, userId, tenantId }) {
  if (conversationId) {
    const existing = await Conversation.findOne({ _id: conversationId, userId, tenantId });
    if (existing) return existing;
  }

  return Conversation.create({ userId, tenantId });
}
