import { z } from 'zod';

/**
 * Maps to: GET /api/reports/ai-overview
 */
export const getBusinessOverview = {
  name: 'getBusinessOverview',
  description:
    'يرجع ملخصًا موحدًا وخفيفًا عن العملاء، الموردين، المبيعات، وأحدث الفواتير دون تحميل تفاصيل زائدة. استخدمها للحصول على نظرة عامة سريعة وموفرة للتوكنات.',
  inputSchema: z.object({
    topClientsLimit: z.number().int().min(1).max(50).optional().default(10).describe('عدد أعلى العملاء مديونية'),
    topSuppliersLimit: z.number().int().min(1).max(50).optional().default(10).describe('عدد أعلى الموردين مديونية'),
    recentSalesLimit: z.number().int().min(1).max(50).optional().default(20).describe('عدد فواتير المبيعات الأخيرة'),
    recentPurchaseInvoicesLimit: z.number().int().min(1).max(50).optional().default(20).describe('عدد فواتير الشراء الأخيرة'),
  }),
  async execute(args, ctx) {
    const { mainBackendClient } = ctx;
    const response = await mainBackendClient.get('/reports/ai-overview', {
      params: {
        topClientsLimit: args.topClientsLimit,
        topSuppliersLimit: args.topSuppliersLimit,
        recentSalesLimit: args.recentSalesLimit,
        recentPurchaseInvoicesLimit: args.recentPurchaseInvoicesLimit,
      },
    });

    return response.data?.data || response.data || null;
  },
};
