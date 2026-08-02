import { z } from 'zod';

/**
 * Maps to: GET /api/reports/sales
 */
export const getSalesSummary = {
  name: 'getSalesSummary',
  description:
    'يرجع تقرير/ملخص المبيعات خلال فترة زمنية (إجمالي المبيعات، عدد الفواتير، أكتر منتج مبيعًا لو متاح). استخدمها لأسئلة زي "كام بعت الأسبوع ده؟" أو "اعمل تقرير مبيعات".',
  inputSchema: z.object({
    from: z.string().optional().describe('تاريخ البداية YYYY-MM-DD'),
    to: z.string().optional().describe('تاريخ النهاية YYYY-MM-DD'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;
    const { data } = await mainBackendClient.get('/reports/sales', {
      params: { from: args.from, to: args.to },
    });
    return data;
  },
};
