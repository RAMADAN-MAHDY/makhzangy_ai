import { systemPromptV1 } from '../prompts/systemPrompt.v1.js';

const prompts = {
  v1: systemPromptV1,
  // v2: systemPromptV2,  // أضف نسخ جديدة هنا لما تتضاف في prompts/
};

const ACTIVE_VERSION = 'v1';

export function getActiveSystemPrompt() {
  return { version: ACTIVE_VERSION, text: prompts[ACTIVE_VERSION] };
}
