(function () {
  "use strict";

  /* ── Storage keys ───────────────────────────────────────── */

  var KEYS = Object.freeze({
    conversations: "chat_conversations_v2",
    activeConversation: "chat_active_conversation",
    settings: "chat_settings_v2",
    theme: "chat_theme"
  });

  /* ── Helpers ─────────────────────────────────────────────── */

  /**
   * Safely parse a JSON string, returning `fallback` on any error.
   * @param {string}  value
   * @param {*}       fallback
   * @returns {*}
   */
  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  /**
   * Generate a unique identifier.
   * Uses `crypto.randomUUID()` when available, with a Date+random fallback.
   * @returns {string}
   */
  function generateId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  /* ── Theme ──────────────────────────────────────────────── */

  /**
   * Read the persisted theme, defaulting to `defaultTheme`.
   * @param {string} [defaultTheme='dark']
   * @returns {string}
   */
  function getTheme(defaultTheme) {
    if (defaultTheme === undefined) defaultTheme = "dark";
    return localStorage.getItem(KEYS.theme) || defaultTheme;
  }

  /**
   * Persist the current theme name.
   * @param {string} theme
   */
  function setTheme(theme) {
    localStorage.setItem(KEYS.theme, theme);
  }

  /* ── Settings ───────────────────────────────────────────── */

  /**
   * Load merged settings (stored values override supplied defaults).
   * @param {Object} defaults
   * @returns {Object}
   */
  function getSettings(defaults) {
    var stored = safeJsonParse(
      localStorage.getItem(KEYS.settings) || "{}",
      {}
    );

    var timeoutCandidate = Number(stored.timeoutMs);

    return {
      webhookUrl:
        typeof stored.webhookUrl === "string"
          ? stored.webhookUrl
          : defaults.webhookUrl,
      authToken:
        typeof stored.authToken === "string"
          ? stored.authToken
          : defaults.authToken,
      botName:
        typeof stored.botName === "string" && stored.botName.trim()
          ? stored.botName
          : defaults.botName,
      timeoutMs:
        Number.isFinite(timeoutCandidate) && timeoutCandidate >= 5000
          ? timeoutCandidate
          : defaults.timeoutMs,
      preferredLanguage:
        typeof stored.preferredLanguage === "string" &&
        stored.preferredLanguage
          ? stored.preferredLanguage
          : defaults.preferredLanguage
    };
  }

  /**
   * Persist settings to a single storage key (no duplicates).
   * @param {Object} settings
   */
  function setSettings(settings) {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  }

  /* ── Multi-conversation storage ─────────────────────────── */

  /**
   * Return all conversations from localStorage.
   * Each conversation: { id, title, createdAt, updatedAt, messages: [] }
   * @returns {Array<Object>}
   */
  function getAllConversations() {
    var raw = localStorage.getItem(KEYS.conversations);
    var list = safeJsonParse(raw, []);
    return Array.isArray(list) ? list : [];
  }

  /**
   * Persist the full conversations array to localStorage.
   * @param {Array<Object>} list
   */
  function _saveAllConversations(list) {
    localStorage.setItem(KEYS.conversations, JSON.stringify(list));
  }

  /**
   * Find a single conversation by `id`.
   * @param {string} id
   * @returns {Object|null}
   */
  function getConversation(id) {
    var list = getAllConversations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /**
   * Save (insert or update) a conversation in the persisted array.
   * Matches on `conversation.id`. Updates `updatedAt` automatically.
   * @param {Object} conversation
   */
  function saveConversation(conversation) {
    var list = getAllConversations();
    var found = false;

    conversation.updatedAt = new Date().toISOString();

    for (var i = 0; i < list.length; i++) {
      if (list[i].id === conversation.id) {
        list[i] = conversation;
        found = true;
        break;
      }
    }

    if (!found) {
      list.push(conversation);
    }

    _saveAllConversations(list);
  }

  /**
   * Remove a conversation by `id`.
   * @param {string} id
   */
  function deleteConversation(id) {
    var list = getAllConversations().filter(function (c) {
      return c.id !== id;
    });
    _saveAllConversations(list);
  }

  /**
   * Get the id of the currently-active conversation.
   * @returns {string|null}
   */
  function getActiveConversationId() {
    return localStorage.getItem(KEYS.activeConversation) || null;
  }

  /**
   * Set the id of the currently-active conversation.
   * @param {string} id
   */
  function setActiveConversationId(id) {
    localStorage.setItem(KEYS.activeConversation, id);
  }

  /**
   * Create a brand-new conversation object (and persist it).
   * @param {string} [title]
   * @returns {Object} The newly created conversation
   */
  function createConversation(title) {
    var now = new Date().toISOString();
    var conversation = {
      id: generateId(),
      title: title || "گفتگوی جدید",
      createdAt: now,
      updatedAt: now,
      messages: []
    };

    saveConversation(conversation);
    return conversation;
  }

  /**
   * Update specific fields of an existing conversation.
   * Only updates the provided fields, keeps others intact.
   * @param {string} id - Conversation ID to update
   * @param {Object} updates - Object with fields to update (e.g. { title: "new title" })
   */
  function updateConversation(id, updates) {
    var conv = getConversation(id);
    if (!conv) return;
    
    Object.keys(updates).forEach(function(key) {
      conv[key] = updates[key];
    });
    
    saveConversation(conv);
  }

  /* ── Legacy compatibility aliases ───────────────────────── *
   *  These methods map the old single-history / session API   *
   *  onto the new multi-conversation layer so that existing   *
   *  consumers (e.g. app.js) keep working without changes.    *
   * ────────────────────────────────────────────────────────── */

  /**
   * Ensure there is an active conversation and return its id.
   * Creates one if none exists.
   * @returns {string}
   */
  function getSessionId() {
    var activeId = getActiveConversationId();
    if (activeId && getConversation(activeId)) return activeId;

    var conv = createConversation();
    setActiveConversationId(conv.id);
    return conv.id;
  }

  /**
   * Start a fresh session (conversation), returning the new id.
   * @returns {string}
   */
  function resetSessionId() {
    var conv = createConversation();
    setActiveConversationId(conv.id);
    return conv.id;
  }

  /**
   * Return the message array from the active conversation.
   * @returns {Array<Object>}
   */
  function getHistory() {
    var id = getActiveConversationId();
    if (!id) return [];
    var conv = getConversation(id);
    return conv ? conv.messages : [];
  }

  /**
   * Replace the message array of the active conversation.
   * @param {Array<Object>} history
   */
  function setHistory(history) {
    var id = getSessionId();
    var conv = getConversation(id);
    if (!conv) return;
    conv.messages = history;
    saveConversation(conv);
  }

  /**
   * Clear all messages in the active conversation.
   */
  function clearHistory() {
    var id = getActiveConversationId();
    if (!id) return;
    var conv = getConversation(id);
    if (!conv) return;
    conv.messages = [];
    saveConversation(conv);
  }

  /* ── Public API ─────────────────────────────────────────── */

  window.ChatStorage = {
    /* Constants */
    KEYS: KEYS,

    /* Utilities */
    safeJsonParse: safeJsonParse,
    generateId: generateId,

    /* Theme */
    getTheme: getTheme,
    setTheme: setTheme,

    /* Settings */
    getSettings: getSettings,
    setSettings: setSettings,

    /* Multi-conversation CRUD */
    getAllConversations: getAllConversations,
    getConversation: getConversation,
    saveConversation: saveConversation,
    deleteConversation: deleteConversation,
    getActiveConversationId: getActiveConversationId,
    setActiveConversationId: setActiveConversationId,
    createConversation: createConversation,
    updateConversation: updateConversation,

    /* Legacy compatibility (used by app.js) */
    getSessionId: getSessionId,
    resetSessionId: resetSessionId,
    generateSessionId: generateId,
    getHistory: getHistory,
    setHistory: setHistory,
    clearHistory: clearHistory
  };
})();
