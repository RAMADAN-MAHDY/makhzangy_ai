import { z } from 'zod';
import { resolveDateRange } from '../utils/datePeriods.js';

/**
 * Maps to: GET /api/reports/sales
 */
export const getSalesSummary = {
  name: 'getSalesSummary',
  description:
    'يرجع تقرير/ملخص المبيعات خلال فترة زمنية (إجمالي المبيعات، عدد الفواتير، أكتر منتج مبيعًا لو متاح). استخدمها لأسئلة زي "كام بعت الأسبوع ده؟" أو "اعمل تقرير مبيعات".',
  inputSchema: z.object({
    period: z
      .enum(['today', 'yesterday', 'current_week', 'current_month', 'current_year'])
      .optional()
      .describe('فترة نسبية مثل اليوم، أمس، هذا الأسبوع، هذا الشهر، هذه السنة'),
    from: z.string().optional().describe('تاريخ البداية YYYY-MM-DD'),
    to: z.string().optional().describe('تاريخ النهاية YYYY-MM-DD'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;
    const { from, to } = resolveDateRange(args);
    const { data } = await mainBackendClient.get('/reports/sales', {
      params: { from, to },
    });
    return data;
  },
};
