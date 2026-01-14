// logger.js
// Обертка для логирования с проверкой окружения (dev/prod)
// Предотвращает вывод логов в production для улучшения производительности

(function() {
  'use strict';

  /**
   * Определяет, находится ли приложение в режиме разработки
   * @returns {boolean} true, если dev режим
   */
  function isDevMode() {
    // Проверяем hostname (localhost, 127.0.0.1, *.local - это dev)
    const hostname = window.location.hostname;
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.endsWith('.local')) {
      return true;
    }

    // Проверяем наличие параметра ?dev=true в URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dev') === 'true') {
      return true;
    }

    // Проверяем наличие meta-тега с режимом разработки
    const devMeta = document.querySelector('meta[name="app-mode"]');
    if (devMeta && devMeta.content === 'development') {
      return true;
    }

    // По умолчанию считаем production (безопаснее)
    return false;
  }

  const DEV_MODE = isDevMode();

  /**
   * Обертка для console.log
   */
  function log(...args) {
    if (DEV_MODE) {
      console.log(...args);
    }
  }

  /**
   * Обертка для console.error
   * Всегда логирует ошибки, но в production может быть более сдержанным
   */
  function error(...args) {
    if (DEV_MODE) {
      console.error(...args);
    } else {
      // В production логируем только критические ошибки
      // Можно добавить отправку на сервер для мониторинга
      console.error(...args);
    }
  }

  /**
   * Обертка для console.warn
   */
  function warn(...args) {
    if (DEV_MODE) {
      console.warn(...args);
    }
  }

  /**
   * Обертка для console.debug
   */
  function debug(...args) {
    if (DEV_MODE) {
      console.debug(...args);
    }
  }

  /**
   * Обертка для console.info
   */
  function info(...args) {
    if (DEV_MODE) {
      console.info(...args);
    }
  }

  /**
   * Группировка логов (только в dev)
   */
  function group(...args) {
    if (DEV_MODE) {
      console.group(...args);
    }
  }

  /**
   * Закрытие группы (только в dev)
   */
  function groupEnd() {
    if (DEV_MODE) {
      console.groupEnd();
    }
  }

  /**
   * Группировка логов с коллапсом (только в dev)
   */
  function groupCollapsed(...args) {
    if (DEV_MODE) {
      console.groupCollapsed(...args);
    }
  }

  // Экспорт в window для обратной совместимости
  if (typeof window !== 'undefined') {
    window.Logger = {
      log,
      error,
      warn,
      debug,
      info,
      group,
      groupEnd,
      groupCollapsed,
      isDevMode: () => DEV_MODE
    };

    // Опционально: заменить глобальные console методы (можно включить через флаг)
    // Это можно сделать, если нужно полностью отключить console в production
    // Но лучше оставить возможность использовать нативный console при необходимости
  }
})();
