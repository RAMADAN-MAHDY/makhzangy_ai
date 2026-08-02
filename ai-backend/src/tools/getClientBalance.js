import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Maps to: GET /api/clients?search=...  then  GET /api/clients/:id/balance
 * (يبحث عن العميل بالاسم الأول، ولو لقى تطابق واحد يجيب رصيده مباشرة)
 */
export const getClientBalance = {
  name: 'getClientBalance',
  description:
    'يبحث عن عميل بالاسم ويرجع رصيده/مديونيته الحالية. استخدمها لسؤال "كام مديونية العميل؟" أو "ابحث عن عميل".',
  inputSchema: z.object({
    clientName: z.string().min(1).describe('اسم العميل كامل أو جزء منه'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;

    const { data: searchResult } = await mainBackendClient.get('/clients', {
      params: { search: args.clientName, limit: 5 },
    });

    const clients = searchResult?.data || searchResult?.clients || searchResult || [];

    if (!Array.isArray(clients) || clients.length === 0) {
      throw new AppError(`مفيش عميل باسم "${args.clientName}"`, 404, 'CLIENT_NOT_FOUND');
    }

    if (clients.length > 1) {
      return {
        ambiguous: true,
        matches: clients.map((c) => ({ id: c._id || c.id, name: c.name })),
        message: 'لقيت أكتر من عميل بنفس الاسم، حدد المقصود بالظبط.',
      };
    }

    const client = clients[0];
    const clientId = client._id || client.id;

    const { data: balance } = await mainBackendClient.get(`/clients/${clientId}/balance`);

    return { client: { id: clientId, name: client.name }, balance };
  },
};
