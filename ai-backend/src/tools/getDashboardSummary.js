import { z } from 'zod';
import { resolveDateRange } from '../utils/datePeriods.js';

/**
 * Maps to: GET /api/reports/summary  (and /api/reports/daily for "today")
 */
export const getDashboardSummary = {
  name: 'getDashboardSummary',
  description:
    'يرجع ملخص عام للنشاط (مبيعات، مشتريات، أرباح، عدد الفواتير) خلال فترة معينة أو النهارده. استخدمها لأسئلة زي "إيه ملخص النشاط؟" أو "كام مبيعات النهارده؟".',
  inputSchema: z.object({
    period: z
      .enum(['today', 'yesterday', 'current_week', 'current_month', 'current_year'])
      .optional()
      .describe('فترة نسبية مثل اليوم، أمس، هذا الأسبوع، هذا الشهر، هذه السنة'),
    from: z.string().optional().describe('تاريخ البداية YYYY-MM-DD (اختياري)'),
    to: z.string().optional().describe('تاريخ النهاية YYYY-MM-DD (اختياري)'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;
    const { from, to } = resolveDateRange(args);
    const useDaily = !from && !to;

    const { data } = await mainBackendClient.get(
      useDaily ? '/reports/daily' : '/reports/summary',
      { params: useDaily ? {} : { from, to } }
    );

    return data;
  },
};
