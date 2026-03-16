(function () {
  "use strict";

  const markedLib = typeof window.marked !== "undefined" ? window.marked : null;
  const purifier = typeof window.DOMPurify !== "undefined" ? window.DOMPurify : null;
  const highlighter = typeof window.hljs !== "undefined" ? window.hljs : null;

  if (markedLib && typeof markedLib.setOptions === "function") {
    markedLib.setOptions({
      gfm: true,
      breaks: true
    });
  }

  function formatTime(isoValue) {
    const date = isoValue ? new Date(isoValue) : new Date();
    return new Intl.DateTimeFormat("fa-AF", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function markdownToSafeHtml(text) {
    const raw = String(text || "");

    if (!markedLib || typeof markedLib.parse !== "function") {
      return `<p>${escapeHtml(raw).replace(/\n/g, "<br>")}</p>`;
    }

    const parsed = markedLib.parse(raw);

    if (purifier && typeof purifier.sanitize === "function") {
      return purifier.sanitize(parsed, {
        USE_PROFILES: { html: true }
      });
    }

    return parsed;
  }

  async function copyText(text) {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "readonly");
    temp.style.position = "fixed";
    temp.style.top = "-9999px";
    document.body.appendChild(temp);
    temp.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      temp.remove();
    }

    return ok;
  }

  function emitCopyEvent(ok, text) {
    window.dispatchEvent(
      new CustomEvent("chat:copy", {
        detail: { ok: Boolean(ok), text: text || "" }
      })
    );
  }

  function buildTypingIndicator() {
    const row = document.createElement("article");
    row.className = "msg-row assistant";
    row.id = "typing-row";

    row.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="msg-card">
        <div class="msg-content">
          <span class="typing-dots" aria-label="در حال نوشتن">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    `;

    return row;
  }

  function buildMessageRow(entry) {
    const row = document.createElement("article");
    row.className = `msg-row ${entry.role}`;
    row.dataset.searchText = String(entry.text || "").toLowerCase();

    const icon = entry.role === "user" ? "fa-user" : "fa-robot";
    const isAssistant = entry.role === "assistant";
    const isSystem = entry.role === "system";
    const canCopy = entry.role === "assistant" || entry.role === "user";

    const contentHtml = isAssistant
      ? markdownToSafeHtml(entry.text || "")
      : `<p>${escapeHtml(entry.text || "")}</p>`;

    row.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid ${icon}"></i></div>
      <div class="msg-card ${entry.error ? "msg-error" : ""} ${
      isSystem ? "msg-system" : ""
    }">
        <div class="msg-content">${contentHtml}</div>
        <div class="msg-meta">
          <span>${formatTime(entry.timeIso)}</span>
          <span class="msg-actions">
            ${canCopy ? '<button class="msg-action-btn" data-action="copy">کپی</button>' : ""}
          </span>
        </div>
      </div>
    `;

    if (highlighter && typeof highlighter.highlightElement === "function") {
      row.querySelectorAll("pre code").forEach((block) =>
        highlighter.highlightElement(block)
      );
    }

    if (canCopy) {
      const btn = row.querySelector("[data-action='copy']");
      if (btn) {
        btn.addEventListener("click", async () => {
          try {
            const ok = await copyText(String(entry.text || ""));
            emitCopyEvent(ok, String(entry.text || ""));
          } catch (_) {
            emitCopyEvent(false, String(entry.text || ""));
          }
        });
      }
    }

    return row;
  }

  function scrollToBottom(container) {
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }

  function appendMessage(container, entry) {
    if (!container) return;
    container.appendChild(buildMessageRow(entry));
    scrollToBottom(container);
  }

  function renderHistory(container, history) {
    if (!container) return;
    container.innerHTML = "";
    history.forEach((entry) => container.appendChild(buildMessageRow(entry)));
    scrollToBottom(container);
  }

  function showTyping(container) {
    if (!container) return;
    removeTyping(container);
    container.appendChild(buildTypingIndicator());
    scrollToBottom(container);
  }

  function removeTyping(container) {
    if (!container) return;
    const typing = container.querySelector("#typing-row");
    if (typing) typing.remove();
  }

  function setStatus(element, text, kind = "info") {
    if (!element) return;
    element.textContent = text;
    element.dataset.kind = kind;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "light" ? "light" : "dark"
    );
  }

  function updateCharCounter(element, value, limit) {
    if (!element) return;

    const length = String(value || "").length;
    element.textContent = `${length} / ${limit}`;
    element.classList.remove("warning", "danger");

    if (length >= limit) {
      element.classList.add("danger");
      return;
    }

    if (length >= Math.floor(limit * 0.85)) {
      element.classList.add("warning");
    }
  }

  function showToast(container, text, kind = "info", timeoutMs = 2600) {
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${kind}`;
    toast.textContent = text;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 220);
    }, timeoutMs);
  }

  function downloadFile(fileName, content, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderPromptButtons(container, prompts, onPromptClick) {
    if (!container) return;

    container.innerHTML = "";
    prompts.forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "prompt-chip";
      button.textContent = prompt;
      button.addEventListener("click", () => onPromptClick(prompt));
      container.appendChild(button);
    });
  }

  function filterMessages(container, query) {
    if (!container) return;

    const term = String(query || "").trim().toLowerCase();
    const rows = container.querySelectorAll(".msg-row");

    rows.forEach((row) => {
      if (!term) {
        row.classList.remove("filtered-out");
        return;
      }

      const haystack = row.dataset.searchText || "";
      if (haystack.includes(term)) {
        row.classList.remove("filtered-out");
      } else {
        row.classList.add("filtered-out");
      }
    });
  }

  window.ChatUI = {
    appendMessage,
    renderHistory,
    showTyping,
    removeTyping,
    setStatus,
    applyTheme,
    updateCharCounter,
    showToast,
    downloadFile,
    renderPromptButtons,
    filterMessages
  };
})();
