import { z } from 'zod';

export const chatMessageSchema = z.object({
  conversationId: z.string().optional().describe('لو مش موجود، هيتعمل Conversation جديد'),
  message: z.string().min(1, 'الرسالة لا يمكن أن تكون فارغة').max(2000),
});
