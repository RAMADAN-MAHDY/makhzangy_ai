import { z } from 'zod';

/**
 * Maps to: GET /api/reports/summary  (and /api/reports/daily for "today")
 */
export const getDashboardSummary = {
  name: 'getDashboardSummary',
  description:
    'يرجع ملخص عام للنشاط (مبيعات، مشتريات، أرباح، عدد الفواتير) خلال فترة معينة أو النهارده. استخدمها لأسئلة زي "إيه ملخص النشاط؟" أو "كام مبيعات النهارده؟".',
  inputSchema: z.object({
    from: z.string().optional().describe('تاريخ البداية YYYY-MM-DD (اختياري)'),
    to: z.string().optional().describe('تاريخ النهاية YYYY-MM-DD (اختياري)'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;
    const useDaily = !args.from && !args.to;

    const { data } = await mainBackendClient.get(
      useDaily ? '/reports/daily' : '/reports/summary',
      { params: useDaily ? {} : { from: args.from, to: args.to } }
    );

    return data;
  },
};
