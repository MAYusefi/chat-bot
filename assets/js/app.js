(function () {
  "use strict";

  const { ChatConfig, ChatStorage, ChatApi, ChatUI, ChatConversations } = window;

  if (!ChatConfig || !ChatStorage || !ChatApi || !ChatUI) {
    return;
  }

  const {
    DEFAULT_SETTINGS,
    QUICK_PROMPTS,
    TEXTS,
    MAX_MESSAGE_CHARS,
    MAX_HISTORY_ITEMS
  } = ChatConfig;

  const elements = {
    botTitle: document.getElementById("botTitle"),
    statusLine: document.getElementById("statusLine"),
    connectionState: document.getElementById("connectionState"),
    sessionBadge: document.getElementById("sessionBadge"),
    messages: document.getElementById("messages"),
    promptList: document.getElementById("promptList"),
    promptSection: document.getElementById("promptSection"),
    searchInput: document.getElementById("searchInput"),
    searchClearBtn: document.querySelector(".search-clear-btn"),
    chatForm: document.getElementById("chatForm"),
    messageInput: document.getElementById("messageInput"),
    sendBtn: document.getElementById("sendBtn"),
    charCount: document.getElementById("charCount"),
    newChatBtn: document.getElementById("newChatBtn"),
    clearChatBtn: document.getElementById("clearChatBtn"),
    retryBtn: document.getElementById("retryBtn"),
    exportTxtBtn: document.getElementById("exportTxtBtn"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    themeBtn: document.getElementById("themeBtn"),
    settingsDialog: document.getElementById("settingsDialog"),
    settingsForm:
      document.getElementById("settingsForm") ||
      (document.getElementById("settingsDialog")
        ? document.getElementById("settingsDialog").querySelector("form")
        : null),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    webhookUrlInput: document.getElementById("webhookUrlInput"),
    authTokenInput: document.getElementById("authTokenInput"),
    botNameInput: document.getElementById("botNameInput"),
    timeoutInput: document.getElementById("timeoutInput"),
    languageInput: document.getElementById("languageInput"),
    resetSettingsBtn: document.getElementById("resetSettingsBtn"),
    toastContainer: document.getElementById("toastContainer"),
    conversationList: document.getElementById("conversationList"),
    sidebar: document.querySelector(".sidebar"),
    sidebarOverlay: document.querySelector(".sidebar-overlay"),
    mobileMenuBtn: document.querySelector(".mobile-menu-btn"),
    hamburgerBtn: document.querySelector(".hamburger-btn"),
    scrollToBottom: document.getElementById("scrollToBottom"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmOk: document.getElementById("confirmOk"),
    confirmCancel: document.getElementById("confirmCancel")
  };

  if (!elements.chatForm || !elements.messageInput || !elements.messages) {
    return;
  }

  const state = {
    settings: ChatStorage.getSettings(DEFAULT_SETTINGS),
    sessionId: ChatStorage.getSessionId(),
    history: [],
    isSending: false,
    lastUserMessage: ""
  };

  function makeEntry(role, text, extra = {}) {
    return {
      id: ChatStorage.generateSessionId(),
      role,
      text: String(text || ""),
      timeIso: new Date().toISOString(),
      error: Boolean(extra.error)
    };
  }

  function extractLatestUserMessage(history) {
    const latest = [...history].reverse().find((item) => item.role === "user");
    return latest ? latest.text : "";
  }

  function clipHistory() {
    if (state.history.length > MAX_HISTORY_ITEMS) {
      state.history = state.history.slice(state.history.length - MAX_HISTORY_ITEMS);
    }
  }

  function persistHistory() {
    clipHistory();
    ChatStorage.setHistory(state.history);

    if (ChatConversations && typeof ChatConversations.renderList === "function") {
      ChatConversations.renderList(state.sessionId);
    }
  }

  function updateRetryState() {
    if (!elements.retryBtn) return;
    elements.retryBtn.disabled = !state.lastUserMessage || state.isSending;
  }

  function updateSessionBadge() {
    if (!elements.sessionBadge) return;
    const short = state.sessionId.slice(0, 8);
    elements.sessionBadge.textContent = `سشن: ${short}...`;
  }

  function updateHeading() {
    if (!elements.botTitle) return;
    elements.botTitle.textContent = state.settings.botName || DEFAULT_SETTINGS.botName;
  }

  function syncThemeFromStorage() {
    const htmlTheme = document.documentElement.getAttribute("data-theme") || "light";
    const theme = ChatStorage.getTheme(htmlTheme);
    ChatUI.applyTheme(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    ChatStorage.setTheme(next);
    ChatUI.applyTheme(next);

    ChatUI.showToast(
      elements.toastContainer,
      `تم ${next === "dark" ? "تیره" : "روشن"} فعال شد.`,
      "success"
    );
  }

  function setSending(sending) {
    state.isSending = sending;
    if (elements.sendBtn) elements.sendBtn.disabled = sending;
    elements.messageInput.disabled = sending;
    if (elements.sendBtn) {
      elements.sendBtn.innerHTML = sending
        ? '<i class="fa-solid fa-spinner fa-spin"></i> در حال ارسال...'
        : '<i class="fa-regular fa-paper-plane"></i> ارسال';
    }
    updateRetryState();
  }

  function isValidWebhookUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function isConfigured() {
    const webhook = String(state.settings.webhookUrl || "").trim();
    const token = String(state.settings.authToken || "").trim();

    if (!webhook || !token) return false;
    if (!isValidWebhookUrl(webhook)) return false;
    if (token === "CHANGE_THIS_TOKEN" || token === "YOUR_SECURE_TOKEN_HERE") return false;

    return true;
  }

  function ensureConfigured(showFeedback) {
    if (isConfigured()) return true;
    if (!showFeedback) return false;

    ChatUI.showToast(
      elements.toastContainer,
      TEXTS.backendNotConfigured || "ابتدا تنظیمات اتصال را کامل کنید.",
      "warning",
      3400
    );
    openSettingsDialog();
    return false;
  }

  function autoResizeMessageInput() {
    const input = elements.messageInput;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 170) + "px";
  }

  function applySearchClearVisibility() {
    if (!elements.searchInput || !elements.searchClearBtn) return;
    const hasValue = Boolean(elements.searchInput.value.trim());
    elements.searchClearBtn.classList.toggle("visible", hasValue);
  }

  function updateScrollToBottomVisibility() {
    if (!elements.messages || !elements.scrollToBottom) return;

    const distanceFromBottom =
      elements.messages.scrollHeight -
      elements.messages.scrollTop -
      elements.messages.clientHeight;

    elements.scrollToBottom.classList.toggle("visible", distanceFromBottom > 140);
  }

  function scrollMessagesToBottom(smooth) {
    if (!elements.messages) return;
    elements.messages.scrollTo({
      top: elements.messages.scrollHeight,
      behavior: smooth ? "smooth" : "auto"
    });
  }

  function updatePromptSectionVisibility() {
    if (!elements.promptSection) return;
    const hasUserMessages = state.history.some((item) => item.role === "user");
    elements.promptSection.style.display = hasUserMessages ? "none" : "block";
  }

  function readMessageInput() {
    return elements.messageInput.value.trim();
  }

  function resetComposer() {
    elements.messageInput.value = "";
    autoResizeMessageInput();
    ChatUI.updateCharCounter(elements.charCount, "", MAX_MESSAGE_CHARS);
    elements.messageInput.focus();
  }

  function addMessage(role, text, extra = {}) {
    const entry = makeEntry(role, text, extra);
    state.history.push(entry);
    persistHistory();
    ChatUI.appendMessage(elements.messages, entry);

    if (role === "user") {
      state.lastUserMessage = entry.text;
    }

    updateRetryState();
    updatePromptSectionVisibility();
    updateScrollToBottomVisibility();

    if (elements.searchInput && elements.searchInput.value.trim()) {
      ChatUI.filterMessages(elements.messages, elements.searchInput.value);
    }

    return entry;
  }

  function setStatus(text, kind) {
    ChatUI.setStatus(elements.statusLine, text, kind);
  }

  function restoreHistoryFromActiveConversation() {
    state.history = ChatStorage.getHistory();

    if (!Array.isArray(state.history)) {
      state.history = [];
    }

    if (state.history.length === 0) {
      state.history.push(makeEntry("assistant", TEXTS.welcome));
      persistHistory();
    }

    state.lastUserMessage = extractLatestUserMessage(state.history);
    ChatUI.renderHistory(elements.messages, state.history);
    updateRetryState();
    updatePromptSectionVisibility();
    updateScrollToBottomVisibility();
  }

  function buildPayload(message) {
    return {
      message,
      sessionId: state.sessionId,
      authToken: state.settings.authToken,
      clientTimestamp: new Date().toISOString(),
      clientVersion: "portfolio-chat-v4",
      preferredLanguage: state.settings.preferredLanguage
    };
  }

  async function sendMessage(customMessage = "") {
    if (state.isSending) return;
    if (!ensureConfigured(true)) return;

    const text = String(customMessage || readMessageInput()).trim();

    if (!text) {
      ChatUI.showToast(elements.toastContainer, TEXTS.emptyMessage, "warning");
      return;
    }

    if (text.length > MAX_MESSAGE_CHARS) {
      ChatUI.showToast(elements.toastContainer, TEXTS.tooLongMessage, "warning");
      return;
    }

    if (!customMessage) {
      resetComposer();
    }

    const existingUserCount = state.history.filter((item) => item.role === "user").length;
    addMessage("user", text);

    if (
      existingUserCount === 0 &&
      ChatConversations &&
      typeof ChatConversations.updateTitle === "function"
    ) {
      ChatConversations.updateTitle(state.sessionId, text);
    }

    ChatUI.showTyping(elements.messages);
    setStatus("در حال دریافت پاسخ...", "info");
    setSending(true);

    try {
      const data = await ChatApi.sendMessage(buildPayload(text), state.settings);
      ChatUI.removeTyping(elements.messages);

      const reply = String(data.reply || data.message || "پاسخی دریافت نشد.");
      const isError = String(data.status || "").toLowerCase() === "error";
      addMessage("assistant", reply, { error: isError });

      if (isError) {
        setStatus("پاسخ با خطا دریافت شد.", "warning");
      } else {
        setStatus("پاسخ با موفقیت دریافت شد.", "success");
      }
    } catch (error) {
      ChatUI.removeTyping(elements.messages);
      const errorText = `${TEXTS.requestFailed} ${error && error.message ? `(${error.message})` : ""}`.trim();
      addMessage("assistant", errorText, { error: true });
      setStatus("ارسال ناموفق بود.", "error");
    } finally {
      setSending(false);
      elements.messageInput.focus();
      updateScrollToBottomVisibility();
    }
  }

  function clearActiveConversationHistory() {
    state.history = [];
    ChatStorage.clearHistory();
    ChatUI.renderHistory(elements.messages, []);
    addMessage("system", TEXTS.chatCleared);
    updatePromptSectionVisibility();
  }

  function exportHistoryAsText() {
    const lines = state.history.map((item) => {
      const roleName =
        item.role === "user" ? "کاربر" : item.role === "assistant" ? "دستیار" : "سیستم";
      return `[${new Date(item.timeIso).toLocaleString("fa-AF")}] ${roleName}: ${item.text}`;
    });

    ChatUI.downloadFile(`chat-${state.sessionId}.txt`, lines.join("\n\n"));
  }

  function exportHistoryAsJson() {
    ChatUI.downloadFile(
      `chat-${state.sessionId}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          sessionId: state.sessionId,
          settings: {
            botName: state.settings.botName,
            preferredLanguage: state.settings.preferredLanguage,
            webhookUrl: state.settings.webhookUrl
          },
          messages: state.history
        },
        null,
        2
      ),
      "application/json;charset=utf-8"
    );
  }

  function openSettingsDialog() {
    if (!elements.settingsDialog) return;

    applySettingsToForm(state.settings);

    if (
      typeof elements.settingsDialog.showModal === "function" &&
      !elements.settingsDialog.open
    ) {
      elements.settingsDialog.showModal();
      if (elements.webhookUrlInput) elements.webhookUrlInput.focus();
    }
  }

  function applySettingsToForm(settings) {
    // webhookUrl and authToken are locked — not shown in form
    if (elements.botNameInput) {
      elements.botNameInput.value = settings.botName || DEFAULT_SETTINGS.botName;
    }
    if (elements.timeoutInput) {
      elements.timeoutInput.value = String(settings.timeoutMs || DEFAULT_SETTINGS.timeoutMs);
    }
    if (elements.languageInput) {
      elements.languageInput.value =
        settings.preferredLanguage || DEFAULT_SETTINGS.preferredLanguage;
    }
  }

  function closeSettingsDialog() {
    if (!elements.settingsDialog) return;
    if (typeof elements.settingsDialog.close === "function") {
      elements.settingsDialog.close();
    }
  }

  function normalizeTimeout(timeoutValue) {
    const value = Number(timeoutValue);
    if (!Number.isFinite(value)) return DEFAULT_SETTINGS.timeoutMs;
    return Math.min(120000, Math.max(5000, Math.round(value)));
  }

  function saveSettings(event) {
    event.preventDefault();

    const botName = (elements.botNameInput ? elements.botNameInput.value : "").trim();
    const preferredLanguage = elements.languageInput
      ? elements.languageInput.value
      : DEFAULT_SETTINGS.preferredLanguage;
    const timeoutMs = normalizeTimeout(
      elements.timeoutInput ? elements.timeoutInput.value : DEFAULT_SETTINGS.timeoutMs
    );

    // webhookUrl and authToken are always locked to config defaults — not user-editable
    state.settings = {
      webhookUrl: DEFAULT_SETTINGS.webhookUrl,
      authToken: DEFAULT_SETTINGS.authToken,
      botName: botName || DEFAULT_SETTINGS.botName,
      timeoutMs,
      preferredLanguage: preferredLanguage || DEFAULT_SETTINGS.preferredLanguage
    };

    ChatStorage.setSettings(state.settings);
    updateHeading();
    closeSettingsDialog();

    ChatUI.showToast(elements.toastContainer, TEXTS.settingsSaved, "success");
    setStatus("تنظیمات جدید فعال شد.", "success");
  }

  function resetSettingsToDefault(event) {
    event.preventDefault();
    state.settings = { ...DEFAULT_SETTINGS };
    ChatStorage.setSettings(state.settings);
    applySettingsToForm(state.settings);
    ChatUI.showToast(elements.toastContainer, "تنظیمات به پیش‌فرض بازنشانی شد.", "success");
  }

  function showConfirmDialog(options) {
    const title = options && options.title ? options.title : "تأیید";
    const message = options && options.message ? options.message : "آیا مطمئن هستید؟";
    const okLabel = options && options.okLabel ? options.okLabel : "تأیید";
    const danger = Boolean(options && options.danger);

    if (
      !elements.confirmDialog ||
      !elements.confirmOk ||
      !elements.confirmCancel ||
      typeof elements.confirmDialog.showModal !== "function"
    ) {
      return Promise.resolve(window.confirm(message));
    }

    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    elements.confirmOk.textContent = okLabel;

    elements.confirmOk.classList.toggle("btn-danger", danger);
    elements.confirmOk.classList.toggle("btn-primary", !danger);

    return new Promise((resolve) => {
      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onDialogCancel = (event) => {
        event.preventDefault();
        finish(false);
      };
      const onDialogClose = () => finish(false);

      const cleanup = () => {
        elements.confirmOk.removeEventListener("click", onOk);
        elements.confirmCancel.removeEventListener("click", onCancel);
        elements.confirmDialog.removeEventListener("cancel", onDialogCancel);
        elements.confirmDialog.removeEventListener("close", onDialogClose);
        if (elements.confirmDialog.open) {
          elements.confirmDialog.close();
        }
      };

      elements.confirmOk.addEventListener("click", onOk);
      elements.confirmCancel.addEventListener("click", onCancel);
      elements.confirmDialog.addEventListener("cancel", onDialogCancel);
      elements.confirmDialog.addEventListener("close", onDialogClose);
      elements.confirmDialog.showModal();
    });
  }

  function openSidebar() {
    if (!elements.sidebar || !elements.sidebarOverlay) return;
    elements.sidebar.classList.add("open");
    elements.sidebarOverlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    if (!elements.sidebar || !elements.sidebarOverlay) return;
    elements.sidebar.classList.remove("open");
    elements.sidebarOverlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  function handleConnectivityChange(notify) {
    if (!elements.connectionState) return;

    if (navigator.onLine) {
      elements.connectionState.textContent = "اتصال: آنلاین";
      if (notify) {
        ChatUI.showToast(elements.toastContainer, TEXTS.networkOnline, "success");
      }
    } else {
      elements.connectionState.textContent = "اتصال: آفلاین";
      if (notify) {
        ChatUI.showToast(elements.toastContainer, TEXTS.networkOffline, "warning");
      }
    }
  }

  function handleConversationSwitch(conversationId) {
    state.sessionId = conversationId;
    ChatStorage.setActiveConversationId(conversationId);
    updateSessionBadge();
    restoreHistoryFromActiveConversation();

    if (elements.searchInput && elements.searchInput.value.trim()) {
      ChatUI.filterMessages(elements.messages, elements.searchInput.value);
    }

    setStatus("گفتگو بارگذاری شد.", "info");
    closeSidebar();
  }

  function handleNewConversation() {
    ChatUI.showToast(elements.toastContainer, TEXTS.newConversation, "success");
    setStatus("گفتگوی جدید آماده است.", "success");
  }

  function initializeConversationModule() {
    if (!ChatConversations || typeof ChatConversations.init !== "function") return;

    ChatConversations.init(
      {
        conversationList: elements.conversationList,
        newChatBtn: elements.newChatBtn
      },
      {
        onSwitchConversation: handleConversationSwitch,
        onNewConversation: handleNewConversation,
        confirmDelete: function (message, callback) {
          showConfirmDialog({
            title: "حذف گفتگو",
            message: message || "آیا از حذف این گفتگو مطمئن هستید؟",
            okLabel: "حذف شود",
            danger: true
          }).then(callback);
        }
      }
    );
  }

  function bindEvents() {
    elements.chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await sendMessage();
    });

    elements.messageInput.addEventListener("input", () => {
      ChatUI.updateCharCounter(elements.charCount, elements.messageInput.value, MAX_MESSAGE_CHARS);
      autoResizeMessageInput();
    });

    elements.messageInput.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await sendMessage();
      }
    });

    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", () => {
        ChatUI.filterMessages(elements.messages, elements.searchInput.value);
        applySearchClearVisibility();
      });
    }

    if (elements.searchClearBtn && elements.searchInput) {
      elements.searchClearBtn.addEventListener("click", () => {
        elements.searchInput.value = "";
        ChatUI.filterMessages(elements.messages, "");
        applySearchClearVisibility();
        elements.searchInput.focus();
      });
    }

    if (elements.clearChatBtn) {
      elements.clearChatBtn.addEventListener("click", async () => {
        const ok = await showConfirmDialog({
          title: "پاک‌سازی گفتگو",
          message: "تمام پیام‌های این گفتگو حذف شوند؟",
          okLabel: "پاک شود",
          danger: true
        });

        if (!ok) return;
        clearActiveConversationHistory();
        setStatus("تاریخچه پاک شد.", "success");
      });
    }

    if (elements.retryBtn) {
      elements.retryBtn.addEventListener("click", async () => {
        if (!state.lastUserMessage) return;
        await sendMessage(state.lastUserMessage);
      });
    }

    if (elements.exportTxtBtn) {
      elements.exportTxtBtn.addEventListener("click", exportHistoryAsText);
    }
    if (elements.exportJsonBtn) {
      elements.exportJsonBtn.addEventListener("click", exportHistoryAsJson);
    }
    if (elements.themeBtn) {
      elements.themeBtn.addEventListener("click", toggleTheme);
    }
    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener("click", openSettingsDialog);
    }
    if (elements.cancelSettingsBtn) {
      elements.cancelSettingsBtn.addEventListener("click", closeSettingsDialog);
    }
    if (elements.settingsForm) {
      elements.settingsForm.addEventListener("submit", saveSettings);
    }
    if (elements.resetSettingsBtn) {
      elements.resetSettingsBtn.addEventListener("click", resetSettingsToDefault);
    }

    if (elements.mobileMenuBtn) {
      elements.mobileMenuBtn.addEventListener("click", openSidebar);
    }
    if (elements.hamburgerBtn) {
      elements.hamburgerBtn.addEventListener("click", closeSidebar);
    }
    if (elements.sidebarOverlay) {
      elements.sidebarOverlay.addEventListener("click", closeSidebar);
    }

    if (elements.messages) {
      elements.messages.addEventListener("scroll", updateScrollToBottomVisibility);
    }
    if (elements.scrollToBottom) {
      elements.scrollToBottom.addEventListener("click", () => scrollMessagesToBottom(true));
    }

    window.addEventListener("online", () => handleConnectivityChange(true));
    window.addEventListener("offline", () => handleConnectivityChange(true));

    window.addEventListener("chat:copy", (event) => {
      const ok = event && event.detail ? event.detail.ok : false;
      if (ok) {
        ChatUI.showToast(elements.toastContainer, TEXTS.copied, "success");
      } else {
        ChatUI.showToast(elements.toastContainer, TEXTS.copyFailed, "error");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (ChatConversations && typeof ChatConversations.createNew === "function") {
          ChatConversations.createNew(true);
        }
      }
    });
  }

  function initPrompts() {
    if (!elements.promptList) return;

    ChatUI.renderPromptButtons(elements.promptList, QUICK_PROMPTS, (prompt) => {
      elements.messageInput.value = prompt;
      ChatUI.updateCharCounter(elements.charCount, prompt, MAX_MESSAGE_CHARS);
      autoResizeMessageInput();
      elements.messageInput.focus();
      updatePromptSectionVisibility();
    });
  }

  function init() {
    syncThemeFromStorage();
    initializeConversationModule();

    state.sessionId = ChatStorage.getSessionId();
    updateSessionBadge();
    state.settings = ChatStorage.getSettings(DEFAULT_SETTINGS);

    updateHeading();
    restoreHistoryFromActiveConversation();
    bindEvents();
    initPrompts();
    handleConnectivityChange(false);
    ChatUI.updateCharCounter(elements.charCount, elements.messageInput.value, MAX_MESSAGE_CHARS);
    autoResizeMessageInput();
    applySearchClearVisibility();
    updateScrollToBottomVisibility();

    if (!isConfigured()) {
      ChatUI.showToast(elements.toastContainer, TEXTS.tokenWarning, "warning", 3600);
      setStatus("تنظیمات اتصال کامل نیست.", "warning");
    }
  }

  init();
})();
