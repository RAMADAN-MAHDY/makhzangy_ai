# دليل تكامل الصوت للـ Frontend (Voice Integration Guide)

دليل مختصر وعملي لمطوري Frontend للتعامل مع ميزات الصوت (Speech-to-Text & Text-to-Speech) في مشروع المخزنجي.

---

## 🔄 مسار العمل (Flow)

```text
[تسجيل صوتي] ──> POST /api/voice/transcribe ──> [عرض النص في صندوق المحادثة لتعديله] ──> [إرسال للشات الحالي POST /api/ai/chat]
                                                                                                      │
                                                                                                      ▼
[سماع الإجابة 🔊] <── تشغيل الصوت <── POST /api/voice/synthesize <── [عرض إجابة البوت]
```

> **ملاحظات UX مهمة:**
> 1. **لا ترسل النص للشات تلقائياً** بعد تحويل الصوت لنص؛ اسمح للمستخدم بمراجعة وتعديل النص أولاً.
> 2. **لا تشغّل الصوت تلقائياً (No Auto-play)** عند وصول إجابة البوت؛ يتم تشغيل الصوت فقط عند ضغط المستخدم على زر 🔊.

---

## 📡 1. تحويل الصوت إلى نص (STT)

تحويل التسجيل الصوتي الخاص بالعميل إلى نص مكتوب.

* **Endpoint:** `POST /api/voice/transcribe`
* **Headers:** `Authorization: Bearer <USER_JWT>`
* **Content-Type:** `multipart/form-data`

### Request Body:
ارسل الملف الصوتي كـ `FormData` باسم الحقل `audio`:

```js
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');
```

### Successful Response (200 OK):
```json
{
  "success": true,
  "text": "كام قطعة من صنف أندومي بالخضار موجودة في المخزن الرئيسي؟"
}
```

### Error Response (429 Rate Limited):
عند تجاوز حد الاستخدام الخاص بالمستخدم أو بالخدمة:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_USER_RPM",
    "message": "لقد وصلت للحد المسموح من الطلبات حاليًا. حاول مرة أخرى بعد قليل.",
    "retryAfterSeconds": 60
  }
}
```

---

## 🔊 2. تحويل النص إلى صوت (TTS)

تحويل نص رد البوت إلى صوت عند ضغط المستخدم على زر الاستماع 🔊.

* **Endpoint:** `POST /api/voice/synthesize`
* **Headers:** 
  * `Authorization: Bearer <USER_JWT>`
  * `Content-Type: application/json`

### Request Body:
```json
{
  "text": "الكمية المتاحة حالياً من صنف أندومي بالخضار هي 45 قطعة."
}
```

### Successful Response (200 OK):
يرجع الصوت بصيغة `base64`:
```json
{
  "success": true,
  "audio": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA...",
  "mimeType": "audio/wav",
  "cached": false
}
```

---

## 💻 3. أمثلة كود جاهزة (JavaScript / React)

### أ. تسجيل الصوت وإرساله للـ STT:
```js
// 1. بدء وإيقاف التسجيل الصوتي
const mediaRecorder = new MediaRecorder(stream);
const chunks = [];

mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(chunks, { type: 'audio/webm' });
  
  // 2. رفع الصوت للـ STT
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userJwt}` },
    body: formData,
  });

  const data = await res.json();
  
  if (data.success) {
    // 3. وضع النص في صندوق الإدخال بدلاً من الإرسال الفوري
    inputField.value = data.text;
  } else {
    alert(data.error.message); // عرض الرسالة العربية للمستخدم
  }
};
```

### ب. طلب وتشغيل الصوت عند الضغط على 🔊:
```js
async function playMessageAudio(textMessage) {
  const res = await fetch('/api/voice/synthesize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: textMessage })
  });

  const data = await res.json();

  if (data.success) {
    // تشغيل الصوت المرجع بصيغة Base64
    const audioSrc = `data:${data.mimeType};base64,${data.audio}`;
    const audio = new Audio(audioSrc);
    audio.play();
  } else {
    alert(data.error.message);
  }
}
```

---

## ⚠️ الأخطاء الشائعة والـ Error Codes

جميع الأخطاء ترجع برسائل عربية جاهزة للعرض المباشر للمستخدم في `error.message`:

| الكود (`error.code`) | السبب | الإجراء الموصى به |
|---|---|---|
| `RATE_LIMIT_USER_RPM` | تجاوز حد الطلبات في الدقيقة | عرض الرسالة واستخدام `retryAfterSeconds` لعمل عد تنازلي |
| `RATE_LIMIT_USER_RPD` | تجاوز الحد اليومي للمستخدم | إبلاغ المستخدم بالانتظار للغد |
| `PROVIDER_RATE_LIMIT` | ضغط على المزود | عرض رسالة الانتظار والترتيب لطلب جديد بعد قليل |
| `AUDIO_TOO_LARGE` | حجم الملف الصوتي أطول من المسموح | تنبيه المستخدم بتقليل مدة التسجيل |
