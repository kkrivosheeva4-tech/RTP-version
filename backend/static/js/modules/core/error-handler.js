// error-handler.js — ES module
// Единая точка входа для логирования и показа ошибок пользователю.

import Logger from './logger.js';

function formatMessage(error) {
  if (error == null) return 'Неизвестная ошибка';
  if (typeof error === 'string') return error;
  return error.message || String(error);
}

function logError(error, context) {
  const ctxStr = typeof context === 'string' ? context : (context && context.action ? context.action : JSON.stringify(context || ''));
  Logger.warn('[reportError] ' + ctxStr, error);
}

function showToUser(error, contextLabel, options) {
  const msg = formatMessage(error);
  if (typeof window === 'undefined') return;

  if (window.ErrorDisplay && (options && options.retryCallback)) {
    try {
      window.ErrorDisplay.show(error, contextLabel, options.retryCallback);
      return;
    } catch (e) {
      Logger.warn('ErrorDisplay.show failed', e);
    }
  }
  if (window.ErrorDisplay) {
    try {
      window.ErrorDisplay.show(error, contextLabel);
      return;
    } catch (e) {
      Logger.warn('ErrorDisplay.show failed', e);
    }
  }
  if (window.Toast) {
    try {
      window.Toast.error(msg);
    } catch (e) {
      Logger.warn('Toast.error failed', e);
    }
  }
}

/**
 * Единая точка входа: логирует ошибку и при необходимости показывает пользователю.
 */
export function reportError(error, context, options) {
  const opts = options || {};
  const contextLabel = typeof context === 'string' ? context : (context && context.action ? context.action : 'Ошибка');
  logError(error, context);
  if (opts.showToUser !== false) {
    showToUser(error, contextLabel, { retryCallback: opts.retryCallback });
  }
}

/**
 * Показ ошибок валидации форм.
 */
export function reportValidationErrors(fieldErrors) {
  if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) return;
  const messages = fieldErrors.map((e) => (typeof e === 'string' ? e : (e.message || e.field || 'Ошибка')));
  const text = messages.join('; ');
  Logger.warn('[reportValidationErrors]', fieldErrors);
  if (typeof window !== 'undefined' && window.Toast) {
    try {
      window.Toast.warning(text.length > 200 ? text.slice(0, 200) + '…' : text);
    } catch (e) {
      Logger.warn('Toast.warning failed', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.reportError = reportError;
  window.reportValidationErrors = reportValidationErrors;
}
