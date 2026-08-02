import { getDashboardSummary } from './getDashboardSummary.js';
import { getSalesSummary } from './getSalesSummary.js';
import { getLowStock } from './getLowStock.js';
import { searchItems } from './searchItems.js';
import { getClientBalance } from './getClientBalance.js';

/**
 * First 5 Tools (Sprint 4 — Capability Map v1: Dashboard / Sales / Inventory / Clients).
 * To add a new tool: create a file here following the same shape
 * ({ name, description, inputSchema, execute(args, ctx) }) and add it below.
 * See docs/AI_AGENT_INSTRUCTIONS.md for the full "how to add a tool" guide.
 */
export const allTools = [
  getDashboardSummary,
  getSalesSummary,
  getLowStock,
  searchItems,
  getClientBalance,
];
