import { Message } from '../models/Message.js';
import { getActiveSystemPrompt } from '../registry/promptRegistry.js';
import { getCurrentDateInfo } from '../utils/datePeriods.js';

const LAST_N_MESSAGES = 12;

/**
 * Builds what we send to Gemini for a turn:
 *  - system prompt (active version)
 *  - conversation summary (if any), injected as context
 *  - last N raw messages, converted to Gemini "contents" format
 */
export async function buildContext(conversation) {
  const { text: systemPromptBase } = getActiveSystemPrompt();
  const { currentDate, timeZone } = getCurrentDateInfo();

  const dynamicPrompt = `
معلومات النظام الحالية:
- التاريخ الحالي: ${currentDate}
- المنطقة الزمنية: ${timeZone}

اعتمد دائماً على التاريخ الحالي عند تفسير:
اليوم - أمس - بكرة - هذا الأسبوع - هذا الشهر - هذه السنة.

المحادثة السابقة لهذا الحوار متاحة لك الآن كجزء من السياق. استخدم هذا السياق عند الإجابة على أي سؤال عن الكلام اللي اتقال قبل كده.
  `.trim();

  const promptParts = [systemPromptBase, dynamicPrompt];
  if (conversation.summary) {
    promptParts.push(`ملخص المحادثة السابقة (للسياق فقط):\n${conversation.summary}`);
  }

  const systemPrompt = promptParts.join('\n\n');

  const recentMessages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(LAST_N_MESSAGES)
    .lean();

  recentMessages.reverse(); // chronological order

  const history = recentMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  return { systemPrompt, history };
}
