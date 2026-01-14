// offline-handler.js
// Модуль для обработки online/offline событий с уведомлениями пользователю

(function() {
  'use strict';

  let offlineNotification = null;
  let onlineNotification = null;

  /**
   * Показывает уведомление об отсутствии соединения
   */
  function showOfflineNotification() {
    // Скрываем уведомление о восстановлении соединения, если оно было показано
    if (onlineNotification) {
      hideOnlineNotification();
    }

    // Проверяем, не показано ли уже уведомление
    if (offlineNotification) {
      return;
    }

    // Создаем уведомление
    offlineNotification = document.createElement('div');
    offlineNotification.className = 'offline-notification';
    offlineNotification.setAttribute('role', 'alert');
    offlineNotification.setAttribute('aria-live', 'assertive');
    offlineNotification.innerHTML = `
      <div class="offline-notification-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>Нет подключения к интернету. Некоторые функции могут быть недоступны.</span>
      </div>
    `;

    document.body.appendChild(offlineNotification);

    // Анимация появления
    requestAnimationFrame(() => {
      offlineNotification.classList.add('visible');
    });
  }

  /**
   * Скрывает уведомление об отсутствии соединения
   */
  function hideOfflineNotification() {
    if (!offlineNotification) return;

    offlineNotification.classList.remove('visible');
    offlineNotification.classList.add('hiding');

    setTimeout(() => {
      if (offlineNotification && offlineNotification.parentNode) {
        offlineNotification.parentNode.removeChild(offlineNotification);
      }
      offlineNotification = null;
    }, 300);
  }

  /**
   * Показывает уведомление о восстановлении соединения
   */
  function showOnlineNotification() {
    // Скрываем уведомление об отсутствии соединения
    if (offlineNotification) {
      hideOfflineNotification();
    }

    // Проверяем, не показано ли уже уведомление
    if (onlineNotification) {
      return;
    }

    // Создаем уведомление
    onlineNotification = document.createElement('div');
    onlineNotification.className = 'online-notification';
    onlineNotification.setAttribute('role', 'alert');
    onlineNotification.setAttribute('aria-live', 'polite');
    onlineNotification.innerHTML = `
      <div class="online-notification-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Подключение к интернету восстановлено.</span>
      </div>
    `;

    document.body.appendChild(onlineNotification);

    // Анимация появления
    requestAnimationFrame(() => {
      onlineNotification.classList.add('visible');
    });

    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
      hideOnlineNotification();
    }, 3000);
  }

  /**
   * Скрывает уведомление о восстановлении соединения
   */
  function hideOnlineNotification() {
    if (!onlineNotification) return;

    onlineNotification.classList.remove('visible');
    onlineNotification.classList.add('hiding');

    setTimeout(() => {
      if (onlineNotification && onlineNotification.parentNode) {
        onlineNotification.parentNode.removeChild(onlineNotification);
      }
      onlineNotification = null;
    }, 300);
  }

  /**
   * Инициализация обработчиков online/offline событий
   */
  function init() {
    // Обработчик потери соединения
    window.addEventListener('offline', () => {
      showOfflineNotification();
    });

    // Обработчик восстановления соединения
    window.addEventListener('online', () => {
      showOnlineNotification();
    });

    // Проверяем начальное состояние соединения
    if (!navigator.onLine) {
      showOfflineNotification();
    }
  }

  /**
   * Очистка обработчиков (для предотвращения утечек памяти)
   */
  function destroy() {
    hideOfflineNotification();
    hideOnlineNotification();
    // Обработчики событий будут автоматически удалены при закрытии страницы
  }

  // Экспорт в window
  if (typeof window !== 'undefined') {
    window.OfflineHandler = {
      init,
      destroy,
      showOfflineNotification,
      hideOfflineNotification,
      showOnlineNotification,
      hideOnlineNotification
    };

    // Автоматическая инициализация при загрузке DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
