# Makhzangy AI Backend (Skeleton)

خدمة مستقلة (AI Backend) بتربط نظام "مخزنجي" الحالي بمساعد ذكاء اصطناعي (Gemini) عن طريق Function Calling.
منفذة حسب التصميم الموجود في `docs/03_Makhzangy_AI_Technical_Design.docx` و`docs/Makhzangy_AI_Core_Backend_Architecture.docx`.

## القواعد الأساسية للمعمارية

- **مفيش اتصال مباشر بقاعدة بيانات النظام الأساسي.** كل بيانات المخزون/المبيعات/العملاء بتتجاب عن طريق REST API بتاع الـ Main Backend.
- **JWT Forwarding:** الـ AI Backend مبيعملش authorization خاص بيه. بياخد التوكن اللي المستخدم مبعوته، ويبعته زي ما هو لكل نداء على الـ Main Backend، فالصلاحيات والـ tenant scoping بتفضل مركزية في مكان واحد.
- **Read-only حاليًا:** كل الـ 5 Tools بترجع بيانات بس (GET). أي تنفيذ فعلي (إنشاء فاتورة، تعديل منتج...) هيتضاف في "Execution Phase" لاحقًا مع تأكيد صريح من المستخدم قبل التنفيذ (شوف `Warehouse_AI_Capability_Map_v1.docx`).

## التشغيل محليًا

```bash
cd ai-backend
npm install
cp .env.example .env   # واملأ القيم (GEMINI_API_KEY, MONGO_URI, MAIN_BACKEND_BASE_URL, JWT_SECRET)
npm run dev
```

السيرفر هيشتغل على `http://localhost:5100` بشكل افتراضي.

## الاستخدام

```
POST /api/ai/chat
Headers: Authorization: Bearer <نفس التوكن بتاع المستخدم في النظام الأساسي>
Body: { "conversationId": "optional", "message": "كام مبيعات النهارده؟" }
```

## أول 5 Tools المنفذة (Sprint 4)

| Tool | بينادي |
|---|---|
| `getDashboardSummary` | `GET /reports/summary` أو `/reports/daily` |
| `getSalesSummary` | `GET /reports/sales` |
| `getLowStock` | `GET /items/low-stock` |
| `searchItems` | `GET /items/search` |
| `getClientBalance` | `GET /clients?search=` ثم `GET /clients/:id/balance` |

## إزاي تضيف Tool جديدة

راجع `docs/AI_AGENT_INSTRUCTIONS.md` — فيه دليل كامل خطوة بخطوة، مكتوب مخصوص عشان أي AI Agent (زي Claude Code) يقدر يشتغل على المشروع من غيرك.

## الخطوات الجاية (حسب الـ Roadmap)

- Sprint 5: تفعيل الـ Summary الحقيقي في `memory/summaryService.js` (دلوقتي TODO).
- Sprint 6: ربط الـ Frontend (Chat widget) بـ `/api/ai/chat`.
- Sprint 7: تفصيل الـ Logging/Token metrics أكتر (فيه أساس جاهز في `Message.tokenUsage`).
- Sprint 8: كتابة Tests + Deployment على Railway.
