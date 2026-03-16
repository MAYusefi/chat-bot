(function () {
  "use strict";

  window.ChatConfig = {
    /* ── Limits ─────────────────────────────────────────── */
    MAX_MESSAGE_CHARS: 2000,
    MAX_HISTORY_ITEMS: 250,
    DEBOUNCE_MS: 300,

    /* ── Auto-retry ─────────────────────────────────────── */
    AUTO_RETRY_ATTEMPTS: 3,
    AUTO_RETRY_BASE_MS: 1000,

    /* ── Keyboard shortcuts ─────────────────────────────── */
    KEYBOARD_SHORTCUTS: {
      send: "Enter",
      newLine: "Shift+Enter",
      newChat: "Ctrl+n",
      closeDialog: "Escape"
    },

    /* ── Default settings ───────────────────────────────── */
    DEFAULT_SETTINGS: {
      webhookUrl: "",
      authToken: "",
      botName: "دستیار هوشمند",
      timeoutMs: 25000,
      preferredLanguage: "fa-AF"
    },

    /* ── Quick prompts (Persian / professional) ─────────── */
    QUICK_PROMPTS: [
      "یک ایمیل رسمی کوتاه برای درخواست جلسه آماده کن.",
      "یک گزارش خلاصه مدیریتی از متن زیر بساز.",
      "این متن را حرفه‌ای و کوتاه بازنویسی کن.",
      "برای این پروژه سه ریسک مهم و راه‌حل بده.",
      "یک چک‌لیست اجرای پروژه در ۷ مورد تهیه کن.",
      "مصاحبه شغلی: ۱۰ سوال مهم برای پوزیشن IT بنویس."
    ],

    /* ── UI text strings (Persian / Dari) ───────────────── */
    TEXTS: {
      welcome:
        "سلام! 👋 من آماده‌ام که در کارهای حرفه‌ای، اسناد، ایمیل‌ها و برنامه‌ریزی پروژه به شما کمک کنم.",
      sessionChanged: "سشن جدید ایجاد شد و تاریخچه پاک گردید.",
      chatCleared: "تاریخچه گفتگو پاک شد.",
      settingsSaved: "تنظیمات با موفقیت ذخیره شد.",
      tokenWarning:
        "برای شروع، آدرس وبهوک و توکن امنیتی را از تنظیمات وارد کنید.",
      networkOffline: "اتصال اینترنت قطع است.",
      networkOnline: "اتصال اینترنت دوباره برقرار شد.",
      emptyMessage: "لطفاً یک پیام بنویسید.",
      tooLongMessage: "طول پیام بیشتر از حد مجاز است.",
      requestFailed: "در ارسال درخواست مشکل ایجاد شد.",
      backendNotConfigured: "ابتدا آدرس وبهوک و توکن امنیتی را در تنظیمات ذخیره کنید.",
      invalidWebhookUrl: "آدرس وبهوک معتبر نیست.",
      copied: "متن در حافظه کپی شد.",
      copyFailed: "کپی متن با خطا مواجه شد.",
      newConversation: "گفتگوی جدید ایجاد شد.",
      conversationDeleted: "گفتگو حذف شد.",
      conversationRenamed: "نام گفتگو تغییر کرد.",
      emptyStateTitle: "سلام! چطور می‌توانم کمک کنم؟",
      emptyStateDescription:
        "یکی از پیشنهادهای زیر را انتخاب کنید یا پیام خود را بنویسید."
    }
  };
})();
