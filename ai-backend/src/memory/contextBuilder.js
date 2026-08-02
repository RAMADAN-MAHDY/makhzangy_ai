import { Message } from '../models/Message.js';
import { getActiveSystemPrompt } from '../registry/promptRegistry.js';

const LAST_N_MESSAGES = 12;

/**
 * Builds what we send to Gemini for a turn:
 *  - system prompt (active version)
 *  - conversation summary (if any), injected as context
 *  - last N raw messages, converted to Gemini "contents" format
 */
export async function buildContext(conversation) {
  const { text: systemPromptBase } = getActiveSystemPrompt();

  const recentMessages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(LAST_N_MESSAGES)
    .lean();

  recentMessages.reverse(); // chronological order

  const systemPrompt = conversation.summary
    ? `${systemPromptBase}\n\nملخص المحادثة السابقة (للسياق فقط):\n${conversation.summary}`
    : systemPromptBase;

  const history = recentMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  return { systemPrompt, history };
}
