# مشروع مخزنجي — AI Agent Package

<!--  امر التثبيت علي الجهاز بسبب كسر ال npm and node  -->
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install multer

هذا المجلد يحتوي على:

- **`ai-backend/`** — الكود الفعلي لـ AI Backend (Node.js + Gemini + Function Calling) جاهز للتشغيل، منفذ حسب التخطيط الأصلي. فيه أول 5 Tools شغالة (Dashboard, Sales, Low Stock, Search Items, Client Balance)، وMemory (Conversation + Messages)، وError Handling موحد، وLogging.
- **`docs/`** — ملفات التخطيط الأصلية الـ 4 (Word) + `AI_AGENT_INSTRUCTIONS.md`: دليل مخصص لأي AI Agent (Claude Code أو غيره) هيشتغل على المشروع لاحقًا ويعدّل أو يضيف أي حاجة.

## أول خطوة

اقرأ `ai-backend/README.md` للتشغيل، و`docs/AI_AGENT_INSTRUCTIONS.md` لو هتدي المشروع لوكيل ذكاء اصطناعي يكمل عليه.

## ملاحظة مهمة

الكود ده **Skeleton كامل الوظائف** مش Pseudo-code، لكنه محتاج منك:

1. `npm install` جوه `ai-backend/`.
2. تحط `GEMINI_API_KEY` و`MONGO_URI` و`JWT_SECRET` (لازم يطابق سر الـ Main Backend) في `.env`.
3. تشغّل الـ Main Backend بتاعك بجانبه (`MAIN_BACKEND_BASE_URL`).

بعدها `/api/ai/chat` هيشتغل فعليًا ويقدر يجاوب من بيانات النظام الحقيقية.
