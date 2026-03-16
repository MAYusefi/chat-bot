# چت‌بات (Frontend + n8n Backend)

.

## ویژگی‌ها

- طراحی مدرن و واکنش‌گرا (Responsive)
- ساختار چندفایلی و تمیز (`HTML/CSS/JS` جدا)
- پشتیبانی از Markdown با **Sanitize امنیتی** (`DOMPurify`)
- مدیریت سشن گفتگو + تاریخچه محلی
- جست‌وجو در پیام‌ها
- خروجی گرفتن گفتگو (`TXT` و `JSON`)
- تنظیمات داخلی برای:
  - لینک وبهوک
  - توکن امنیتی
  - نام بات
  - زمان انتظار درخواست
  - زبان ترجیحی پاسخ
- تغییر تم روشن/تیره
- دکمه تلاش دوباره برای پیام آخر
- نمایش وضعیت اتصال آنلاین/آفلاین

## ساختار پروژه

```text
chat bot/
├─ index.html
├─ AI Web Chatbot Backend (1).json
├─ AI Web Chatbot Backend (improved).json
├─ README.md
└─ assets/
   ├─ css/
   │  ├─ base.css             # متغیرهای CSS، فونت، تم، دسترسی‌پذیری
   │  ├─ layout.css           # لی‌اوت، گرید، سایدبار، ریسپانسیو
   │  ├─ components.css       # کامپوننت‌ها (پیام، دکمه، دیالوگ، toast)
   │  └─ animations.css       # انیمیشن‌های حرفه‌ای
   └─ js/
      ├─ config.js            # تنظیمات، متن‌ها، کیبورد شورتکات
      ├─ storage.js           # localStorage، چند مکالمه
      ├─ conversations.js     # مدیریت مکالمات (CRUD)
      ├─ api.js               # ارتباط با بک‌اند + auto-retry
      ├─ ui.js                # رندر DOM، تم، toast
      └─ app.js               # کنترلر اصلی اپلیکیشن
```

## راه‌اندازی سریع

### 1) ایمپورت ورک‌فلو در n8n

پیشنهاد می‌شود فایل `AI Web Chatbot Backend (improved).json` را import کنید.

> فایل `AI Web Chatbot Backend (1).json` نسخه سازگار (legacy) است.

### 2) اتصال Credential مدل

در نود `Groq Model`، credential درست Groq API را وصل کنید.

### 3) تنظیم توکن امنیتی در ورک‌فلو

در نود `Config & Extract` مقدار `sharedSecret` را از `CHANGE_THIS_TOKEN` به یک مقدار امن تغییر دهید.

همچنین مقادیر placeholder زیر را با مقادیر واقعی خودتان جایگزین کنید:

- `YOUR_GROQ_CREDENTIAL_ID`
- `YOUR_DATA_TABLE_ID`

### 4) تنظیم فرانت‌اند

فایل `index.html` را باز کنید، سپس در بخش **تنظیمات** مقدارها را وارد کنید:

- Webhook URL: مثلا `https://your-n8n-domain/webhook/chatbot`
- Auth Token: همان `sharedSecret` مرحله قبل
- Timeout: مهلت پاسخ (پیش‌فرض 25000ms)

> نکته: مقدار پیش‌فرض Webhook و Token در فرانت‌اند خالی است و باید توسط شما تنظیم شود. این مقادیر داخل `localStorage` ذخیره می‌شوند.

## امنیت

- پاسخ Markdown قبل از نمایش، sanitize می‌شود.
- بک‌اند n8n دارای اعتبارسنجی ورودی است:
  - پیام خالی
  - طول پیام
  - بررسی توکن
  - محدودسازی نرخ درخواست (Rate Limit)

#.

