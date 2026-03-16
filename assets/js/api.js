(function () {
  "use strict";

  /* ───────── internal helpers ───────── */

  /**
   * Parse the fetch Response depending on its content-type.
   * JSON bodies are parsed normally; everything else is wrapped as { reply }.
   */
  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (_) {
        return { error: "پاسخ JSON نامعتبر از سرور دریافت شد." };
      }
    }

    const text = await response.text();
    return { reply: text };
  }

  /**
   * Return a Promise that resolves after `ms` milliseconds.
   */
  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /* ───────── single-attempt sender ───────── */

  /**
   * Fire a single POST request to the webhook.
   * Uses AbortController for timeout enforcement (minimum 5 000 ms).
   */
  async function sendMessageOnce(payload, settings) {
    var timeoutMs = Math.max(5000, Number(settings.timeoutMs) || 25000);
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    try {
      var response = await fetch(settings.webhookUrl, {
        method: "POST",
        headers: Object.assign({
          "Content-Type": "application/json"
        }, settings.authToken ? { Authorization: "Bearer " + settings.authToken } : {}),
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      var data = await parseResponse(response);

      if (!response.ok) {
        var serverMessage =
          (data && (data.error || data.message || data.reply)) ||
          "خطای سرور: HTTP " + response.status;
        var error = new Error(serverMessage);
        error.status = response.status;
        error.payload = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        var timeoutError = new Error(
          "زمان پاسخ‌گویی سرور به پایان رسید. لطفاً دوباره تلاش کنید."
        );
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /* ───────── public: sender with retry + exponential back-off ───────── */

  /**
   * Send a message with automatic retries for transient failures.
   *
   * Retry policy:
   *  – Timeout errors  (code === "TIMEOUT") → retry
   *  – Network errors  (no `status` property, e.g. DNS, offline) → retry
   *  – HTTP errors     (4xx / 5xx with `status`) → throw immediately (no retry)
   *  – Retries exhausted → throw the last error
   *
   * Back-off: baseDelay × 2^attempt  (0-indexed attempt counter)
   */
  async function sendMessage(payload, settings) {
    var config = window.ChatConfig || {};
    var maxRetries =
      typeof config.AUTO_RETRY_ATTEMPTS === "number"
        ? config.AUTO_RETRY_ATTEMPTS
        : 3;
    var baseDelay =
      typeof config.AUTO_RETRY_BASE_MS === "number"
        ? config.AUTO_RETRY_BASE_MS
        : 1000;

    var lastError = null;

    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        var data = await sendMessageOnce(payload, settings);
        return data;
      } catch (error) {
        lastError = error;

        /* HTTP errors (have a status code) are non-transient → fail fast */
        if (error.status) {
          throw error;
        }

        /* Transient: timeout or pure network failure */
        var isTransient =
          error.code === "TIMEOUT" || !error.status;

        var hasRetriesLeft = attempt < maxRetries;

        if (isTransient && hasRetriesLeft) {
          var delay = baseDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        /* No retries left or non-retryable → throw */
        throw error;
      }
    }

    /* Safety net – should never be reached */
    if (lastError) {
      throw lastError;
    }

    throw new Error("خطای غیرمنتظره در ارسال پیام.");
  }

  /* ───────── expose public API ───────── */

  window.ChatApi = {
    sendMessage: sendMessage
  };
})();
