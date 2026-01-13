// error-display.js
// Модуль для отображения ошибок с типами и возможностью повтора

window.ErrorDisplay = (function() {
  'use strict';

  // Типы ошибок
  const ErrorTypes = {
    NETWORK: 'NetworkError',
    VALIDATION: 'ValidationError',
    DATA: 'DataError',
    PERMISSION: 'PermissionError',
    UNKNOWN: 'UnknownError'
  };

  /**
   * Определяет тип ошибки на основе её свойств
   * @param {Error|string} error - Ошибка
   * @returns {string} Тип ошибки
   */
  function detectErrorType(error) {
    if (!error) return ErrorTypes.UNKNOWN;

    const errorStr = typeof error === 'string' ? error : (error.message || String(error));
    const errorLower = errorStr.toLowerCase();

    // Сетевые ошибки
    if (
      errorLower.includes('network') ||
      errorLower.includes('fetch') ||
      errorLower.includes('http') ||
      errorLower.includes('timeout') ||
      errorLower.includes('connection') ||
      errorLower.includes('сеть') ||
      errorLower.includes('интернет')
    ) {
      return ErrorTypes.NETWORK;
    }

    // Ошибки валидации
    if (
      errorLower.includes('validation') ||
      errorLower.includes('invalid') ||
      errorLower.includes('required') ||
      errorLower.includes('валидация') ||
      errorLower.includes('неверный') ||
      errorLower.includes('обязательное')
    ) {
      return ErrorTypes.VALIDATION;
    }

    // Ошибки данных
    if (
      errorLower.includes('data') ||
      errorLower.includes('parse') ||
      errorLower.includes('json') ||
      errorLower.includes('данные') ||
      errorLower.includes('формат')
    ) {
      return ErrorTypes.DATA;
    }

    // Ошибки доступа
    if (
      errorLower.includes('permission') ||
      errorLower.includes('access') ||
      errorLower.includes('forbidden') ||
      errorLower.includes('unauthorized') ||
      errorLower.includes('доступ') ||
      errorLower.includes('разрешение')
    ) {
      return ErrorTypes.PERMISSION;
    }

    return ErrorTypes.UNKNOWN;
  }

  /**
   * Форматирует сообщение об ошибке для пользователя
   * @param {Error|string} error - Ошибка
   * @param {string} type - Тип ошибки
   * @returns {string} Понятное сообщение
   */
  function formatUserMessage(error, type) {
    const errorStr = typeof error === 'string' ? error : (error.message || String(error));

    const messages = {
      [ErrorTypes.NETWORK]: 'Проблема с подключением к серверу. Проверьте интернет-соединение.',
      [ErrorTypes.VALIDATION]: 'Ошибка валидации данных. Проверьте введенные значения.',
      [ErrorTypes.DATA]: 'Ошибка обработки данных. Попробуйте обновить страницу.',
      [ErrorTypes.PERMISSION]: 'Недостаточно прав для выполнения этого действия.',
      [ErrorTypes.UNKNOWN]: 'Произошла ошибка. Попробуйте позже.'
    };

    // Если есть детальное сообщение, используем его
    if (errorStr && errorStr.length < 200) {
      return errorStr;
    }

    return messages[type] || messages[ErrorTypes.UNKNOWN];
  }

  /**
   * Показывает ошибку пользователю
   * @param {Error|string} error - Ошибка
   * @param {string} context - Контекст ошибки
   * @param {Function} retryCallback - Функция для повтора (опционально)
   */
  function show(error, context = '', retryCallback = null) {
    const type = detectErrorType(error);
    const userMessage = formatUserMessage(error, context || error);
    const canRetry = retryCallback && typeof retryCallback === 'function';

    // Логируем ошибку для разработчиков
    console.error(`[ErrorDisplay] ${type}`, {
      error,
      context,
      userMessage,
      canRetry
    });

    // Создаем контейнер для ошибок, если его нет
    let container = document.getElementById('errorContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'errorContainer';
      container.className = 'error-container';
      document.body.appendChild(container);
    }

    // Создаем элемент ошибки
    const errorEl = document.createElement('div');
    errorEl.className = `error-display error-${type.toLowerCase().replace('error', '')}`;
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'assertive');

    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    errorEl.id = errorId;

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
        <div class="error-message">${userMessage}</div>
        ${context ? `<div class="error-context">${context}</div>` : ''}
      </div>
      <div class="error-actions">
        ${canRetry ? `<button class="error-retry-btn" data-error-id="${errorId}" aria-label="Повторить">Повторить</button>` : ''}
        <button class="error-close-btn" data-error-id="${errorId}" aria-label="Закрыть">&times;</button>
      </div>
    `;

    container.appendChild(errorEl);

    // Анимация появления
    requestAnimationFrame(() => {
      errorEl.classList.add('visible');
    });

    // Обработчики событий
    const closeBtn = errorEl.querySelector('.error-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hide(errorId);
      });
    }

    if (canRetry) {
      const retryBtn = errorEl.querySelector('.error-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          hide(errorId);
          try {
            retryCallback();
          } catch (retryError) {
            console.error('[ErrorDisplay] Retry failed', retryError);
            show(retryError, 'Ошибка при повторе операции');
          }
        });
      }
    }

    // Автоматическое скрытие через 10 секунд (если нет кнопки повтора)
    if (!canRetry) {
      setTimeout(() => {
        hide(errorId);
      }, 10000);
    }
  }

  /**
   * Показывает ошибку с возможностью повтора
   * @param {Error|string} error - Ошибка
   * @param {Function} retryCallback - Функция для повтора
   * @param {string} context - Контекст ошибки
   */
  function showRetryable(error, retryCallback, context = '') {
    show(error, context, retryCallback);
  }

  /**
   * Скрывает ошибку
   * @param {string} errorId - ID элемента ошибки
   */
  function hide(errorId) {
    const errorEl = document.getElementById(errorId);
    if (!errorEl) return;

    errorEl.classList.remove('visible');
    errorEl.classList.add('hiding');

    setTimeout(() => {
      if (errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl);
      }

      // Если контейнер пуст, удаляем его
      const container = document.getElementById('errorContainer');
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }

  /**
   * Скрывает все ошибки
   */
  function hideAll() {
    const container = document.getElementById('errorContainer');
    if (!container) return;

    const errors = container.querySelectorAll('.error-display');
    errors.forEach(errorEl => {
      hide(errorEl.id);
    });
  }

  return {
    show,
    showRetryable,
    hide,
    hideAll,
    ErrorTypes
  };
})();
