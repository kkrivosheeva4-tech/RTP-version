// toast.js
// Модуль для toast уведомлений с очередью

window.Toast = (function() {
  'use strict';

  const queue = [];
  const maxVisible = 3; // Максимальное количество видимых уведомлений
  let visibleCount = 0;
  let toastIdCounter = 0;

  // Типы уведомлений
  const ToastType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };

  // Иконки для разных типов
  const icons = {
    [ToastType.SUCCESS]: `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `,
    [ToastType.ERROR]: `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `,
    [ToastType.WARNING]: `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `,
    [ToastType.INFO]: `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `
  };

  // Время показа по умолчанию (в миллисекундах)
  const defaultDuration = {
    [ToastType.SUCCESS]: 3000,
    [ToastType.ERROR]: 5000,
    [ToastType.WARNING]: 4000,
    [ToastType.INFO]: 3000
  };

  /**
   * Создает контейнер для toast уведомлений
   */
  function ensureContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Показывает следующее уведомление из очереди
   */
  function processQueue() {
    if (visibleCount >= maxVisible || queue.length === 0) {
      return;
    }

    const toast = queue.shift();
    showToast(toast);
  }

  /**
   * Показывает toast уведомление
   * @param {Object} options - Опции уведомления
   */
  function showToast(options) {
    const {
      message,
      type = ToastType.INFO,
      duration = defaultDuration[type],
      id = `toast_${Date.now()}_${++toastIdCounter}`
    } = options;

    visibleCount++;

    const container = ensureContainer();
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.id = id;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');

    const escapedMessage = window.escapeHtml ? window.escapeHtml(message) : String(message).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
    toastEl.innerHTML = `
      <div class="toast-icon">${icons[type] || icons[ToastType.INFO]}</div>
      <div class="toast-message">${escapedMessage}</div>
      <button class="toast-close" aria-label="Закрыть уведомление">&times;</button>
    `;

    container.appendChild(toastEl);

    // Анимация появления
    requestAnimationFrame(() => {
      toastEl.classList.add('visible');
    });

    // Обработчик закрытия
    const closeBtn = toastEl.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hideToast(id);
      });
    }

    // Автоматическое скрытие
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        hideToast(id);
      }, duration);

      // Сохраняем timeout ID для возможной отмены
      toastEl.dataset.timeoutId = timeoutId;
    }
  }

  /**
   * Скрывает toast уведомление
   * @param {string} id - ID уведомления
   */
  function hideToast(id) {
    const toastEl = document.getElementById(id);
    if (!toastEl) return;

    // Отменяем автоматическое скрытие, если оно еще не произошло
    const timeoutId = toastEl.dataset.timeoutId;
    if (timeoutId) {
      clearTimeout(parseInt(timeoutId, 10));
    }

    toastEl.classList.remove('visible');
    toastEl.classList.add('hiding');

    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
      visibleCount--;
      processQueue(); // Показываем следующее уведомление из очереди
    }, 300);
  }

  /**
   * Показывает toast уведомление
   * @param {string} message - Сообщение
   * @param {string} type - Тип уведомления
   * @param {number} duration - Длительность показа (в мс)
   */
  function show(message, type = ToastType.INFO, duration = null) {
    const toastOptions = {
      message,
      type,
      duration: duration !== null ? duration : defaultDuration[type]
    };

    if (visibleCount >= maxVisible) {
      // Добавляем в очередь
      queue.push(toastOptions);
    } else {
      // Показываем сразу
      showToast(toastOptions);
    }
  }

  /**
   * Показывает успешное уведомление
   * @param {string} message - Сообщение
   * @param {number} duration - Длительность показа (в мс)
   */
  function success(message, duration = null) {
    show(message, ToastType.SUCCESS, duration);
  }

  /**
   * Показывает уведомление об ошибке
   * @param {string} message - Сообщение
   * @param {number} duration - Длительность показа (в мс)
   */
  function error(message, duration = null) {
    show(message, ToastType.ERROR, duration);
  }

  /**
   * Показывает предупреждение
   * @param {string} message - Сообщение
   * @param {number} duration - Длительность показа (в мс)
   */
  function warning(message, duration = null) {
    show(message, ToastType.WARNING, duration);
  }

  /**
   * Показывает информационное уведомление
   * @param {string} message - Сообщение
   * @param {number} duration - Длительность показа (в мс)
   */
  function info(message, duration = null) {
    show(message, ToastType.INFO, duration);
  }

  /**
   * Скрывает все уведомления
   */
  function hideAll() {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toasts = container.querySelectorAll('.toast');
    toasts.forEach(toast => {
      hideToast(toast.id);
    });

    // Очищаем очередь
    queue.length = 0;
  }

  return {
    show,
    success,
    error,
    warning,
    info,
    hideAll,
    ToastType
  };
})();
