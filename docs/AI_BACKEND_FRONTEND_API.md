# Makhzangy AI Backend - Frontend API Reference

## نظرة عامة
هذا الملف يشرح نقاط النهاية (`endpoints`) المتاحة في AI Backend وكيف يستخدمها الواجهة الأمامية.

- الـ AI Backend يعمل كخدمة وسيطة بين الواجهة الأمامية ونظام المخازن الرئيسي.
- كل طلب يجب يحمل نفس JWT الذي يستخدمه المستخدم في النظام الأصلي.
- أي بيانات تخص المحادثة أو استهلاك التوكنز تُخزن في MongoDB داخل الـ AI Backend.

---

## 1) Health Check

**GET** `/api/health`

يستخدم للتأكد من أن خدمة AI Backend شغالة.

### مثال
```js
fetch('http://localhost:5100/api/health')
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error);
```

---

## 2) إرسال رسالة إلى المساعد AI

**POST** `/api/ai/chat`

### Headers
- `Content-Type: application/json`
- `Authorization: Bearer <JWT>`

### Body
- `message` (مطلوب): نص السؤال أو الأمر.
- `conversationId` (اختياري): معرّف المحادثة السابقة إذا كنت تريد استمرار نفس الجلسة.

### مثال طلب
```js
const response = await fetch('http://localhost:5100/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    message: 'عايز تقرير مبيعات الشهر ده',
    conversationId: existingConversationId, // اختياري
  }),
});

const data = await response.json();
console.log(data);
```

### شكل الاستجابة المتوقعة
```json
{
  "success": true,
  "data": {
    "conversationId": "6a6f4669d502c6495fe9e4fc",
    "reply": "...",
    "toolCalls": [
      { "name": "getSalesSummary", "latencyMs": 150, "error": null }
    ]
  }
}
```

### ملاحظات
- إذا لم يتم إرسال `conversationId`، ستُنشأ محادثة جديدة.
- في أول رسالة يمكن استخدام نفس الـ `conversationId` للمتابعة في الطلب التالي.
- يُستخدم الحقل `conversationId` لحفظ تتبع المحادثات وإعادة استخدام سياق المحادثة السابقة.

---

## 3) جلب رسائل محادثة محددة

**GET** `/api/ai/conversations/:id/messages`

### Headers
- `Authorization: Bearer <JWT>`

### مثال طلب
```js
const conversationId = '6a6f4669d502c6495fe9e4fc';
const response = await fetch(`http://localhost:5100/api/ai/conversations/${conversationId}/messages`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const data = await response.json();
console.log(data);
```

### شكل الاستجابة المتوقعة
```json
{
  "success": true,
  "data": {
    "conversation": { ... },
    "messages": [
      { "role": "user", "content": "...", "createdAt": "..." },
      { "role": "assistant", "content": "...", "tokenUsage": { "promptTokens": 50, "completionTokens": 100, "totalTokens": 150 }, "createdAt": "..." }
    ]
  }
}
```

---

## 4) حساب استهلاك التوكنز للـ Tenant

**GET** `/api/ai/usage`

### Headers
- `Authorization: Bearer <JWT>`

### Query Parameters
- `from` (اختياري): تاريخ البداية بصيغة `YYYY-MM-DD`
- `to` (اختياري): تاريخ النهاية بصيغة `YYYY-MM-DD`

### مثال طلب
```js
const response = await fetch('http://localhost:5100/api/ai/usage?from=2026-08-01&to=2026-08-31', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const data = await response.json();
console.log(data);
```

### شكل الاستجابة المتوقعة
```json
{
  "success": true,
  "data": {
    "totalTokens": 1234,
    "promptTokens": 456,
    "completionTokens": 778,
    "messageCount": 12
  }
}
```

### ملاحظات
- يجمع الاستهلاك عن رسائل الـ `assistant` فقط.
- التجميع يتم عبر جميع المحادثات الخاصة بالـ tenant للمستخدم المصدق عليه.

---

## 5) سيناريو عمل للواجهة الأمامية

1. يسجّل المستخدم دخولًا في Main Backend ويحصل على JWT.
2. يرسل الواجهة الأمامية هذه الـ JWT لكل طلب إلى AI Backend.
3. عند أول رسالة في المحادثة، يرسل فقط `message`.
4. عند استكمال المحادثة، يرسل `conversationId` الذي رجع من الرد السابق.
5. يمكن للواجهة الأمامية عرض النص من `reply` وحفظ `conversationId` للاستمرار في الحوار.

---

## نصائح للفرونت اند
- إذا أردت تجربة المحادثة بدون سياق، احذف `conversationId` من الطلب.
- عند استخدام `conversationId`، ستستفيد من سياق الرسائل السابقة الذي يُبنى داخل الـ AI Backend.
- يمكن استخدام `GET /api/ai/usage` داخل لوحة مراقبة الإدارة لحساب استهلاك التوكنز الشهري.
