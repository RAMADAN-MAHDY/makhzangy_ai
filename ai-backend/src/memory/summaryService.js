import { Message } from '../models/Message.js';

const SUMMARIZE_AFTER_MESSAGES = 30;

/**
 * Placeholder strategy: once a conversation has grown large, this is where
 * we'd call Gemini with a "summarize this conversation in 5 lines" prompt
 * and store the result on Conversation.summary, then optionally prune old
 * Message docs. Left intentionally simple for Sprint 5 — wire up the real
 * summarization call when memory usage/costs need it.
 */
export async function maybeSummarize(conversation) {
  const count = await Message.countDocuments({ conversationId: conversation._id });
  if (count < SUMMARIZE_AFTER_MESSAGES) return;

  // TODO: call Gemini to produce a fresh summary from the oldest messages,
  // save it to conversation.summary, then trim old Message docs.
}
