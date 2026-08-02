import { z } from 'zod';

/**
 * Maps to: GET /api/items/search?q=...
 */
export const searchItems = {
  name: 'searchItems',
  description:
    'يبحث عن منتج بالاسم أو الكود أو الفئة، ويرجع الكمية المتاحة والسعر. استخدمها لسؤال "ابحث عن منتج X" أو "اعرض المخزون بتاع منتج معين".',
  inputSchema: z.object({
    query: z.string().min(1).describe('نص البحث: اسم المنتج أو الكود أو الفئة'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;
    const { data } = await mainBackendClient.get('/items/search', {
      params: { search: args.query },
    });
    return data;
  },
};
