// error-display.js — ES module
// Модуль для отображения ошибок с типами и возможностью повтора

import { escapeHtml } from '../core/escape-utils.js';
import Logger from '../core/logger.js';

export const ErrorTypes = {
  NETWORK: 'NetworkError',
  VALIDATION: 'ValidationError',
  DATA: 'DataError',
  PERMISSION: 'PermissionError',
  UNKNOWN: 'UnknownError'
};

export function detectErrorType(error) {
  if (!error) return ErrorTypes.UNKNOWN;
  const errorStr = typeof error === 'string' ? error : (error.message || String(error));
  const errorLower = errorStr.toLowerCase();
  if (/network|fetch|http|timeout|connection|сеть|интернет/.test(errorLower)) return ErrorTypes.NETWORK;
  if (/validation|invalid|required|валидация|неверный|обязательное/.test(errorLower)) return ErrorTypes.VALIDATION;
  if (/data|parse|json|данные|формат/.test(errorLower)) return ErrorTypes.DATA;
  if (/permission|access|forbidden|unauthorized|доступ|разрешение/.test(errorLower)) return ErrorTypes.PERMISSION;
  return ErrorTypes.UNKNOWN;
}

function formatUserMessage(error, type) {
  const errorStr = typeof error === 'string' ? error : (error.message || String(error));
  const messages = {
    [ErrorTypes.NETWORK]: 'Проблема с подключением к серверу. Проверьте интернет-соединение.',
    [ErrorTypes.VALIDATION]: 'Ошибка валидации данных. Проверьте введенные значения.',
    [ErrorTypes.DATA]: 'Ошибка обработки данных. Попробуйте обновить страницу.',
    [ErrorTypes.PERMISSION]: 'Недостаточно прав для выполнения этого действия.',
    [ErrorTypes.UNKNOWN]: 'Произошла ошибка. Попробуйте позже.'
  };
  if (errorStr && errorStr.length < 200) return errorStr;
  return messages[type] || messages[ErrorTypes.UNKNOWN];
}

export function show(error, context = '', retryCallback = null) {
  const type = detectErrorType(error);
  const userMessage = formatUserMessage(error, context || error);
  const canRetry = retryCallback && typeof retryCallback === 'function';

  Logger.warn(`[ErrorDisplay] ${type}`, { error, context, userMessage, canRetry });

  let container = document.getElementById('errorContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'errorContainer';
    container.className = 'error-container';
    document.body.appendChild(container);
  }

  const errorEl = document.createElement('div');
  errorEl.className = `error-display error-${type.toLowerCase().replace('error', '')}`;
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'assertive');
  const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  errorEl.id = errorId;

  const safeUserMessage = escapeHtml(userMessage);
  const safeContext = context ? escapeHtml(context) : '';

  errorEl.innerHTML = `
    <div class="error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <div class="error-content">
      <div class="error-title">Ошибка</div>
      <div class="error-message">${safeUserMessage}</div>
      ${safeContext ? `<div class="error-context">${safeContext}</div>` : ''}
    </div>
    <div class="error-actions">
      ${canRetry ? `<button class="error-retry-btn" data-error-id="${errorId}" aria-label="Повторить">Повторить</button>` : ''}
      <button class="error-close-btn" data-error-id="${errorId}" aria-label="Закрыть">&times;</button>
    </div>
  `;

  container.appendChild(errorEl);
  requestAnimationFrame(() => errorEl.classList.add('visible'));

  const closeBtn = errorEl.querySelector('.error-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', () => hide(errorId));

  if (canRetry) {
    const retryBtn = errorEl.querySelector('.error-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        hide(errorId);
        try {
          retryCallback();
        } catch (retryError) {
          Logger.warn('[ErrorDisplay] Retry failed', retryError);
          show(retryError, 'Ошибка при повторе операции');
        }
      });
    }
  }

  if (!canRetry) setTimeout(() => hide(errorId), 10000);
}

export function showRetryable(error, retryCallback, context = '') {
  show(error, context, retryCallback);
}

export function hide(errorId) {
  const errorEl = document.getElementById(errorId);
  if (!errorEl) return;
  errorEl.classList.remove('visible');
  errorEl.classList.add('hiding');
  setTimeout(() => {
    if (errorEl.parentNode) errorEl.parentNode.removeChild(errorEl);
    const container = document.getElementById('errorContainer');
    if (container && container.children.length === 0) container.remove();
  }, 300);
}

export function hideAll() {
  const container = document.getElementById('errorContainer');
  if (!container) return;
  container.querySelectorAll('.error-display').forEach(errorEl => hide(errorEl.id));
}

const ErrorDisplay = { show, showRetryable, hide, hideAll, ErrorTypes };
if (typeof window !== 'undefined') window.ErrorDisplay = ErrorDisplay;
export default ErrorDisplay;
