// error-handler.js
// Единая точка входа для логирования и показа ошибок пользователю.
// Использование: reportError(error, context) — логирует через Logger и при необходимости показывает через Toast/ErrorDisplay.

(function() {
  'use strict';

  function formatMessage(error) {
    if (error == null) return 'Неизвестная ошибка';
    if (typeof error === 'string') return error;
    return error.message || String(error);
  }

  /**
   * Логирует ошибку через Logger (если доступен).
   * @param {Error|string} error
   * @param {string|object} context — строка или объект, например { action: 'loadData' }
   */
  function logError(error, context) {
    if (typeof window !== 'undefined' && window.Logger) {
      const ctxStr = typeof context === 'string' ? context : (context && context.action ? context.action : JSON.stringify(context || ''));
      window.Logger.warn('[reportError] ' + ctxStr, error);
    }
  }

  /**
   * Показывает ошибку пользователю: ErrorDisplay (с опцией повтора) или Toast.
   * @param {Error|string} error
   * @param {string} contextLabel — подпись контекста для UI
   * @param {{ retryCallback?: function }} options
   */
  function showToUser(error, contextLabel, options) {
    const msg = formatMessage(error);
    if (typeof window === 'undefined') return;

    if (window.ErrorDisplay && (options && options.retryCallback)) {
      try {
        window.ErrorDisplay.show(error, contextLabel, options.retryCallback);
        return;
      } catch (e) {
        if (window.Logger) window.Logger.warn('ErrorDisplay.show failed', e);
      }
    }
    if (window.ErrorDisplay) {
      try {
        window.ErrorDisplay.show(error, contextLabel);
        return;
      } catch (e) {
        if (window.Logger) window.Logger.warn('ErrorDisplay.show failed', e);
      }
    }
    if (window.Toast) {
      try {
        window.Toast.error(msg);
      } catch (e) {
        if (window.Logger) window.Logger.warn('Toast.error failed', e);
      }
    }
  }

  /**
   * Единая точка входа: логирует ошибку и при необходимости показывает пользователю.
   * @param {Error|string} error — ошибка или сообщение
   * @param {string|object} context — контекст для лога и UI (строка или объект, например { action: 'loadData' })
   * @param {{ retryCallback?: function, showToUser?: boolean }} options
   *   - retryCallback: функция повтора (передаётся в ErrorDisplay при наличии)
   *   - showToUser: по умолчанию true; если false — только логирование
   */
  function reportError(error, context, options) {
    const opts = options || {};
    const contextLabel = typeof context === 'string' ? context : (context && context.action ? context.action : 'Ошибка');
    logError(error, context);
    if (opts.showToUser !== false) {
      showToUser(error, contextLabel, { retryCallback: opts.retryCallback });
    }
  }

  /**
   * Показ ошибок валидации форм (например список полей с ошибками).
   * @param {Array<{ field?: string, message: string }>|string[]} fieldErrors — массив объектов { field, message } или строк
   */
  function reportValidationErrors(fieldErrors) {
    if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) return;
    const messages = fieldErrors.map(function(e) {
      return typeof e === 'string' ? e : (e.message || e.field || 'Ошибка');
    });
    const text = messages.join('; ');
    if (typeof window !== 'undefined' && window.Logger) {
      window.Logger.warn('[reportValidationErrors]', fieldErrors);
    }
    if (typeof window !== 'undefined' && window.Toast) {
      try {
        window.Toast.warning(text.length > 200 ? text.slice(0, 200) + '…' : text);
      } catch (e) {
        if (window.Logger) window.Logger.warn('Toast.warning failed', e);
      }
    }
  }

  window.reportError = reportError;
  window.reportValidationErrors = reportValidationErrors;
})();
