import { allTools } from '../tools/index.js';
import { zodToGeminiSchema } from '../utils/zodToGeminiSchema.js';
import { logger } from '../utils/logger.js';

const toolsByName = new Map(allTools.map((tool) => [tool.name, tool]));

/**
 * Gemini "function calling" needs each tool described as:
 * { name, description, parameters: <JSON-schema-like object> }
 */
export function getFunctionDeclarations() {
  return allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: zodToGeminiSchema(tool.inputSchema),
  }));
}

/**
 * Executes a tool by name with validated args and shared context
 * (e.g. an authenticated mainBackendClient bound to the current user's JWT).
 */
export async function executeTool(name, rawArgs, ctx) {
  const tool = toolsByName.get(name);

  if (!tool) {
    throw new Error(`Unknown tool requested by model: ${name}`);
  }

  const parsed = tool.inputSchema.safeParse(rawArgs || {});
  if (!parsed.success) {
    logger.warn({ name, issues: parsed.error.issues }, 'Tool called with invalid arguments');
    throw new Error(`Invalid arguments for tool "${name}": ${parsed.error.message}`);
  }

  return tool.execute(parsed.data, ctx);
}

export function listToolNames() {
  return [...toolsByName.keys()];
}
