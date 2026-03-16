(function () {
  "use strict";

  const { ChatStorage, ChatUI } = window;

  /* ----------------------------------------------------------
     Private State
     ---------------------------------------------------------- */

  let _elements = { conversationList: null, newChatBtn: null };
  let _callbacks = { onSwitchConversation: null, onNewConversation: null, confirmDelete: null };
  let _activeId = null;

  /* ----------------------------------------------------------
     1. init(elements, callbacks)
     ---------------------------------------------------------- */

  function init(elements, callbacks) {
    _elements = {
      conversationList: elements.conversationList || null,
      newChatBtn: elements.newChatBtn || null
    };

    _callbacks = {
      onSwitchConversation: (callbacks && callbacks.onSwitchConversation) || function () {},
      onNewConversation: (callbacks && callbacks.onNewConversation) || function () {},
      confirmDelete: (callbacks && callbacks.confirmDelete) || null
    };

    // Determine the active conversation
    _activeId = ChatStorage.getActiveConversationId();

    // Ensure at least one conversation exists
    const all = ChatStorage.getAllConversations();
    if (all.length === 0) {
      const created = ChatStorage.createConversation("گفتگوی جدید");
      _activeId = created.id;
      ChatStorage.setActiveConversationId(_activeId);
    } else if (!_activeId || !all.find(function (c) { return c.id === _activeId; })) {
      // Active ID is stale or missing — pick the most recent
      const sorted = all.slice().sort(function (a, b) {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      _activeId = sorted[0].id;
      ChatStorage.setActiveConversationId(_activeId);
    }

    // Render the list
    renderList(_activeId);

    // Bind new-chat button
    if (_elements.newChatBtn) {
      _elements.newChatBtn.addEventListener("click", function () {
        createNew(true);
        _callbacks.onNewConversation();
      });
    }
  }

  /* ----------------------------------------------------------
     2. renderList(activeId)
     ---------------------------------------------------------- */

  function renderList(activeId) {
    if (activeId !== undefined) {
      _activeId = activeId;
    }

    const container = _elements.conversationList;
    if (!container) return;

    // Clear existing content
    container.innerHTML = "";

    const conversations = ChatStorage.getAllConversations();

    // Sort by updatedAt descending (newest first)
    conversations.sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // Empty state
    if (conversations.length === 0) {
      var emptyEl = document.createElement("div");
      emptyEl.className = "conversation-empty";
      emptyEl.style.cssText =
        "text-align:center;padding:24px 12px;color:var(--text-muted);font-size:13px;";
      emptyEl.textContent = "هنوز گفتگویی وجود ندارد.";
      container.appendChild(emptyEl);
      return;
    }

    conversations.forEach(function (conv) {
      var item = buildConversationItem(conv, _activeId);
      container.appendChild(item);
    });
  }

  /* ----------------------------------------------------------
     Build a single conversation item DOM node
     ---------------------------------------------------------- */

  function buildConversationItem(conv, activeId) {
    var item = document.createElement("div");
    item.className = "conversation-item" + (conv.id === activeId ? " active" : "");
    item.dataset.id = conv.id;

    // — Title text
    var textEl = document.createElement("span");
    textEl.className = "conversation-item-text";
    textEl.textContent = truncateTitle(conv.title);
    textEl.title = conv.title || "گفتگوی جدید";
    item.appendChild(textEl);

    // — Relative date
    var dateEl = document.createElement("span");
    dateEl.className = "conversation-item-date";
    dateEl.textContent = getRelativeDate(conv.updatedAt);
    item.appendChild(dateEl);

    // — Action buttons (rename + delete)
    var actionsEl = document.createElement("span");
    actionsEl.className = "conversation-item-actions";

    // Rename button
    var renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.title = "تغییر نام";
    renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    renameBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      handleRename(conv.id, conv.title);
    });
    actionsEl.appendChild(renameBtn);

    // Delete button
    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.title = "حذف گفتگو";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteConversation(conv.id, _callbacks.confirmDelete || confirmDialog);
    });
    actionsEl.appendChild(deleteBtn);

    item.appendChild(actionsEl);

    // — Click to switch
    item.addEventListener("click", function () {
      if (_activeId === conv.id) return;
      _activeId = conv.id;
      ChatStorage.setActiveConversationId(conv.id);
      renderList(_activeId);
      _callbacks.onSwitchConversation(conv.id);
    });

    return item;
  }

  /* ----------------------------------------------------------
     3. createNew(autoSwitch)
     ---------------------------------------------------------- */

  function createNew(autoSwitch) {
    if (autoSwitch === undefined) autoSwitch = true;

    var conv = ChatStorage.createConversation("گفتگوی جدید");

    if (autoSwitch) {
      _activeId = conv.id;
      ChatStorage.setActiveConversationId(conv.id);
    }

    renderList(_activeId);

    if (autoSwitch) {
      _callbacks.onSwitchConversation(conv.id);
    }

    return conv;
  }

  /* ----------------------------------------------------------
     4. renameConversation(id, newTitle)
     ---------------------------------------------------------- */

  function renameConversation(id, newTitle) {
    if (!newTitle || !newTitle.trim()) return;

    ChatStorage.updateConversation(id, { title: newTitle.trim() });
    renderList(_activeId);
  }

  /* ----------------------------------------------------------
     5. deleteConversation(id, confirmFn)
     ---------------------------------------------------------- */

  function deleteConversation(id, confirmFn) {
    var doConfirm = confirmFn || confirmDialog;

    doConfirm("آیا از حذف این گفتگو مطمئن هستید؟", function (accepted) {
      if (!accepted) return;

      ChatStorage.deleteConversation(id);

      // If the deleted conversation was active, switch to another
      if (_activeId === id) {
        var remaining = ChatStorage.getAllConversations();

        if (remaining.length === 0) {
          // No conversations left — create a fresh one
          var created = ChatStorage.createConversation("گفتگوی جدید");
          _activeId = created.id;
          ChatStorage.setActiveConversationId(_activeId);
          renderList(_activeId);
          _callbacks.onSwitchConversation(_activeId);
          return;
        }

        // Switch to the most recently updated
        remaining.sort(function (a, b) {
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        _activeId = remaining[0].id;
        ChatStorage.setActiveConversationId(_activeId);
        renderList(_activeId);
        _callbacks.onSwitchConversation(_activeId);
      } else {
        renderList(_activeId);
      }

      showToast("گفتگو حذف شد.", "success");
    });
  }

  /* ----------------------------------------------------------
     6. updateTitle(id, firstMessage)
     ---------------------------------------------------------- */

  function updateTitle(id, firstMessage) {
    if (!firstMessage || typeof firstMessage !== "string") return;

    var clean = firstMessage.trim();
    if (!clean) return;

    var title = clean.length > 40 ? clean.substring(0, 40) + "..." : clean;

    ChatStorage.updateConversation(id, { title: title });
    renderList(_activeId);
  }

  /* ----------------------------------------------------------
     7. getRelativeDate(isoString)
     ---------------------------------------------------------- */

  function getRelativeDate(isoString) {
    if (!isoString) return "";

    var date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    var now = new Date();

    // Reset times to midnight for day comparison
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    var diffMs = today.getTime() - target.getTime();
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "امروز";
    if (diffDays === 1) return "دیروز";

    // Format as a Persian (fa-AF) date
    try {
      return new Intl.DateTimeFormat("fa-AF", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(date);
    } catch (e) {
      // Fallback for browsers without fa-AF support
      return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
    }
  }

  /* ----------------------------------------------------------
     Private Helpers
     ---------------------------------------------------------- */

  function truncateTitle(title) {
    var text = (title || "گفتگوی جدید").trim();
    if (text.length > 50) {
      return text.substring(0, 50) + "...";
    }
    return text;
  }

  function handleRename(id, currentTitle) {
    var newName = window.prompt("نام جدید گفتگو:", currentTitle || "");
    if (newName !== null && newName.trim()) {
      renameConversation(id, newName);
      showToast("نام گفتگو تغییر کرد.", "success");
    }
  }

  /**
   * Custom confirm dialog using ChatUI toast pattern.
   * Falls back to window.confirm if no toast container is available.
   *
   * @param {string} message  — Confirmation message text
   * @param {function} callback — Called with true (accepted) or false (cancelled)
   */
  function confirmDialog(message, callback) {
    // Try to use a custom inline confirm overlay
    var toastContainer = document.getElementById("toastContainer");

    if (!toastContainer) {
      // Fallback to native confirm
      callback(window.confirm(message));
      return;
    }

    // Build a confirm toast element
    var overlay = document.createElement("div");
    overlay.className = "confirm-dialog-overlay";
    overlay.style.cssText = [
      "position:fixed", "inset:0", "z-index:9999",
      "display:flex", "align-items:center", "justify-content:center",
      "background:rgba(0,0,0,0.45)", "backdrop-filter:blur(4px)",
      "-webkit-backdrop-filter:blur(4px)"
    ].join(";");

    var box = document.createElement("div");
    box.style.cssText = [
      "background:var(--card,#1e293b)", "border:1px solid var(--card-border,#334155)",
      "border-radius:16px", "padding:24px 28px", "max-width:360px", "width:90%",
      "text-align:center", "color:var(--text,#f1f5f9)",
      "box-shadow:0 8px 32px rgba(0,0,0,0.3)", "font-size:14px", "line-height:1.7"
    ].join(";");

    var msgEl = document.createElement("p");
    msgEl.style.cssText = "margin:0 0 18px;font-size:14.5px;";
    msgEl.textContent = message;
    box.appendChild(msgEl);

    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:10px;justify-content:center;";

    var confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.textContent = "بله، حذف شود";
    confirmBtn.style.cssText = "min-width:100px;padding:8px 16px;font-size:13px;";

    var cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-soft";
    cancelBtn.textContent = "انصراف";
    cancelBtn.style.cssText = "min-width:100px;padding:8px 16px;font-size:13px;";

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var onKey = null;

    function cleanup(result) {
      if (onKey) {
        document.removeEventListener("keydown", onKey);
      }
      overlay.remove();
      callback(result);
    }

    confirmBtn.addEventListener("click", function () { cleanup(true); });
    cancelBtn.addEventListener("click", function () { cleanup(false); });

    // Close on overlay background click
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) cleanup(false);
    });

    // Close on Escape key
    onKey = function (e) {
      if (e.key === "Escape") {
        cleanup(false);
      }
    };
    document.addEventListener("keydown", onKey);

    // Focus the cancel button by default (safer option)
    cancelBtn.focus();
  }

  function showToast(message, kind) {
    var container = document.getElementById("toastContainer");
    if (container && ChatUI && ChatUI.showToast) {
      ChatUI.showToast(container, message, kind || "info");
    }
  }

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */

  window.ChatConversations = {
    init: init,
    renderList: renderList,
    createNew: createNew,
    renameConversation: renameConversation,
    deleteConversation: deleteConversation,
    updateTitle: updateTitle,
    getRelativeDate: getRelativeDate
  };
})();
