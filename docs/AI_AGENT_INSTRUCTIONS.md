# تعليمات لأي AI Agent هيشتغل على مشروع "مخزنجي"

الملف ده مخصص لأي وكيل ذكاء اصطناعي (Claude Code، Cursor، Copilot Agent...) هيتفتح عليه المشروع
عشان يعدّل أو يضيف حاجة. اقرأه قبل أي تعديل.

## 1) مكونات المشروع

| المكون | الوصف | التقنية |
|---|---|---|
| `main-backend/` (لو موجود بجانب ده) | النظام الأساسي: مخزون، مبيعات، مشتريات، عملاء، اشتراكات، superadmin | Node.js + Express + MongoDB (Mongoose) |
| `frontend/` (لو موجود بجانب ده) | واجهة المستخدم | Next.js (React) + TypeScript |
| `ai-backend/` (في المجلد ده) | خدمة الذكاء الاصطناعي المستقلة (Gemini + Function Calling) | Node.js 24 (ESM) + Express + MongoDB |
| `docs/` | التخطيط الأصلي (4 ملفات Word) + الملف ده | — |

**التوثيق الكامل لكل الـ Endpoints الموجودة فعليًا في الـ Main Backend موجود في:**
`main-backend/REST_API_DOCUMENTATION_AR.md` — ارجع له دايمًا قبل ما تضيف Tool جديدة أو تفترض شكل Response.

## 2) قواعد صارمة ممنوع تتجاوزها

1. **الـ AI Backend مايتصلش بقاعدة بيانات النظام الأساسي مباشرة أبدًا.** أي بيانات لازم تعدي عن طريق REST API بتاع الـ Main Backend (`src/utils/mainBackendClient.js`).
2. **مفيش authorization/roles جديدة في الـ AI Backend.** كل الصلاحيات بتتحدد في الـ Main Backend. الـ AI Backend بس بيمرر نفس الـ JWT بتاع المستخدم (`req.userJwt` → `Authorization: Bearer` header) في كل نداء.
3. **ممنوع أي Tool تعمل تعديل/إضافة/حذف بيانات (POST/PUT/DELETE) إلا لو المستخدم صراحة طلب المشروع يدخل "Execution Phase"** (شوف `Warehouse_AI_Capability_Map_v1.docx`). ولو اتفعّلت، لازم:
   - الأداة ترجع "ملخص مقترح" الأول (dry-run)، مش تنفذ العملية على طول.
   - يتضاف endpoint/flag منفصل للتأكيد الصريح من المستخدم قبل التنفيذ الفعلي.
   - يتسجل الإجراء في `AuditLog` بتاع الـ Main Backend (الموديل موجود بالفعل: `main-backend/models/AuditLog.js`).
4. **متخترعش بيانات وهمية في الـ prompts أو fallback responses.** لو Tool فشلت، رجّع رسالة خطأ واضحة للمستخدم، متحطش أرقام تخمينية.
5. **متضيفش مكتبات تخترق الـ MAX_TOOL_HOPS loop** في `providers/geminiProvider.js` من غير سبب واضح — ده حماية من استهلاك Gemini tokens بلا نهاية.

## 3) إزاي تضيف Tool جديدة (الأكثر شيوعًا)

1. شوف الـ endpoint المناسب في `main-backend/REST_API_DOCUMENTATION_AR.md`.
2. اعمل ملف جديد في `ai-backend/src/tools/yourToolName.js` بنفس الشكل:
   ```js
   import { z } from 'zod';

   export const yourToolName = {
     name: 'yourToolName',
     description: 'وصف بالعربي واضح، يشرح إمتى الموديل يستخدم الأداة دي',
     inputSchema: z.object({ /* args متوقعة من الموديل */ }),
     async execute(args, ctx) {
       const { data } = await ctx.mainBackendClient.get('/your-endpoint', { params: args });
       return data;
     },
   };
   ```
3. سجّلها في `ai-backend/src/tools/index.js` (ضيفها في `allTools`).
4. مفيش حاجة تانية — الـ Tool Registry بيحولها تلقائي لـ Gemini function declaration.
5. لو الأداة محتاجة تعديل بيانات (POST/PUT/DELETE) → ارجع لقاعدة #3 فوق قبل ما تكمل.

## 4) إزاي تضيف نسخة Prompt جديدة

1. اعمل ملف `ai-backend/src/prompts/systemPrompt.v2.js` يصدّر نص جديد.
2. سجّله في `ai-backend/src/registry/promptRegistry.js` جوه `prompts = { v1, v2 }`.
3. غيّر `ACTIVE_VERSION` لما تكون جاهز تفعّله (ده بيسهّل الرجوع للنسخة القديمة بسرعة).

## 5) الاختبار قبل أي Commit

- شغّل `npm run dev` في `ai-backend/` وتأكد إن `GET /api/health` بيرجع 200.
- ابعت رسالة تجريبية على `POST /api/ai/chat` بتوكن مستخدم حقيقي من الـ Main Backend وتأكد إن الأداة بترجع بيانات حقيقية مش خطأ.
- تأكد إن أي endpoint جديد استخدمته في tool فعلاً موجود وموثّق في `REST_API_DOCUMENTATION_AR.md` — لو مش موجود، متفترضش شكله، ارجع للـ controller نفسه في `main-backend/controllers/`.

## 6) ملفات التخطيط المرجعية (اقرأها لو محتاج سياق أوسع)

- `03_Makhzangy_AI_Technical_Design.docx` — البنية التقنية والـ folder structure.
- `04_Makhzangy_AI_Development_Roadmap.docx` — خطة الـ Sprints.
- `Makhzangy_AI_Core_Backend_Architecture.docx` — القرارات المعمارية الأساسية.
- `Warehouse_AI_Capability_Map_v1.docx` — قائمة الـ Tools المطلوبة والأمثلة على أسئلة المستخدمين، ومرحلة الـ Execution المستقبلية.
