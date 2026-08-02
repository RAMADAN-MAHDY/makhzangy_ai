import { z } from 'zod';

/**
 * Maps to: GET /api/items/low-stock
 */
export const getLowStock = {
  name: 'getLowStock',
  description:
    'يرجع قائمة المنتجات اللي وصلت أو قربت توصل للحد الأدنى من المخزون. استخدمها لسؤال "المنتجات اللي قربت تخلص".',
  inputSchema: z.object({}),
  async execute(_args, ctx) {
    const { mainBackendClient } = ctx;
    const { data } = await mainBackendClient.get('/items/low-stock');
    return data;
  },
};
