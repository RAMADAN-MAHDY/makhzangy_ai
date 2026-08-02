import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { getFunctionDeclarations, executeTool } from '../registry/toolRegistry.js';
import { logger } from '../utils/logger.js';

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const MAX_TOOL_HOPS = 4; // hard cap so a confused model can't loop forever

/**
 * Runs one user turn through Gemini with Function Calling enabled.
 * If the model asks for a tool, we execute it via the Tool Registry
 * (which calls the Main Backend with the user's own JWT) and feed the
 * result back to the model until it produces a final text answer.
 *
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {Array}  params.history   - prior turns in Gemini "contents" format
 * @param {string} params.userMessage
 * @param {object} params.toolCtx   - shared context passed to every tool.execute()
 * @returns {{ text: string, toolCalls: Array, usage: object }}
 */
export async function runGeminiTurn({ systemPrompt, history, userMessage, toolCtx }) {
  const contents = [...history, { role: 'user', parts: [{ text: userMessage }] }];
  const toolCallLog = [];
  let usage = {};

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: getFunctionDeclarations() }],
      },
    });

    usage = response.usageMetadata || usage;

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    if (functionCalls.length === 0) {
      const text = parts.map((p) => p.text || '').join('').trim();
      return { text, toolCalls: toolCallLog, usage };
    }

    // Model wants to call one or more tools — execute them, then loop back.
    contents.push({ role: 'model', parts });

    const functionResponseParts = [];
    for (const call of functionCalls) {
      const startedAt = Date.now();
      try {
        const result = await executeTool(call.name, call.args, toolCtx);
        const latencyMs = Date.now() - startedAt;
        toolCallLog.push({ name: call.name, args: call.args, result, latencyMs });
        functionResponseParts.push({
          functionResponse: { name: call.name, response: { result } },
        });
      } catch (err) {
        const latencyMs = Date.now() - startedAt;
        logger.error({ err, tool: call.name }, 'Tool execution failed');
        toolCallLog.push({ name: call.name, args: call.args, error: err.message, latencyMs });
        functionResponseParts.push({
          functionResponse: { name: call.name, response: { error: err.message } },
        });
      }
    }

    contents.push({ role: 'user', parts: functionResponseParts });
  }

  return {
    text: 'معلش، مقدرتش أوصل لإجابة واضحة دلوقتي. جرّب تسأل بطريقة تانية.',
    toolCalls: toolCallLog,
    usage,
  };
}
