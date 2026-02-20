// core-utils.js
// Объединенный модуль утилит для работы ядра приложения
// Объединяет функциональность: error-handler.js, event-manager.js, memoization.js, module-loader.js, render-queue.js

(function() {
  'use strict';

  // ===== ERROR HANDLER =====
  // Единая точка обработки ошибок.
  // API: handle(error, context), setReporter(fn), setNotifier(fn)

  let reporter = null;   // optional: (error, context) => void (отправка на сервер)
  let notifier = null;   // optional: (message) => void (UI уведомление)
  let retryCallback = null; // optional: функция для повтора ошибки

  function formatMessage(error) {
    if (!error) return 'Неизвестная ошибка';
    if (typeof error === 'string') return error;
    return error.message || String(error);
  }

  /**
   * Получает ErrorDisplay, если он доступен
   */
  function getErrorDisplay() {
    return typeof window !== 'undefined' && window.ErrorDisplay ? window.ErrorDisplay : null;
  }

  const ErrorHandler = {
    handle(error, context = '') {
      window.Logger?.warn(`[ErrorHandler] ${context || 'no-context'}`, error);

      // Используем ErrorDisplay, если доступен
      const ErrorDisplay = getErrorDisplay();
      if (ErrorDisplay) {
        try {
          ErrorDisplay.show(error, context, retryCallback);
        } catch (e) {
          if (window.Logger) window.Logger.warn('ErrorDisplay.show failed', e);
        }
      }

      if (typeof reporter === 'function') {
        try { reporter(error, context); } catch (e) { if (window.Logger) window.Logger.warn('Reporter failed', e); }
      }
      if (typeof notifier === 'function') {
        try { notifier(`Ошибка: ${formatMessage(error)}`); } catch (e) { if (window.Logger) window.Logger.warn('Notifier failed', e); }
      }
    },
    setReporter(fn) { reporter = fn; },
    setNotifier(fn) { notifier = fn; },
    setRetryCallback(fn) { retryCallback = fn; }
  };

  // ===== EVENT MANAGER =====
  // Централизованное делегирование событий и управление подписками.
  // API: on(selector, event, handler), off(selector, event, handler), clear()

  const handlers = new Map(); // key: `${selector}:${event}` => Set<handler>
  const documentListeners = new Map(); // key: `${selector}:${event}` => listener function

  function getKey(selector, event) {
    return `${selector}:${event}`;
  }

  const EventManager = {
    on(selector, event, handler) {
      if (!selector || !event || typeof handler !== 'function') return;
      const key = getKey(selector, event);
      if (!handlers.has(key)) {
        handlers.set(key, new Set());
        // Создаем делегированный обработчик один раз для каждой пары (selector, event)
        const delegatedHandler = (e) => {
          const target = e.target && e.target.closest(selector);
          if (!target) return;
          const set = handlers.get(key);
          if (set && set.size > 0) {
            set.forEach((h) => h(e, target));
          }
        };
        document.addEventListener(event, delegatedHandler);
        documentListeners.set(key, delegatedHandler);
      }
      handlers.get(key).add(handler);
    },
    off(selector, event, handler) {
      const key = getKey(selector, event);
      if (!handlers.has(key)) return;
      if (handler) {
        handlers.get(key).delete(handler);
      } else {
        handlers.set(key, new Set());
      }
      // Если больше нет обработчиков для этой пары, снимаем слушатель с document
      if (handlers.get(key).size === 0) {
        const delegatedHandler = documentListeners.get(key);
        if (delegatedHandler) {
          document.removeEventListener(event, delegatedHandler);
          documentListeners.delete(key);
        }
        handlers.delete(key);
      }
    },
    clear() {
      // Снимаем все слушатели с document
      documentListeners.forEach((handler, key) => {
        const [selector, event] = key.split(':');
        document.removeEventListener(event, handler);
      });
      handlers.clear();
      documentListeners.clear();
    }
  };

  // ===== MEMOIZATION =====
  // Memoization helpers: memoize, memoizeWithTTL, FilterCache for filtered results.

  function memoize(fn) {
    const cache = new Map();
    return function(...args) {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const res = fn.apply(this, args);
      cache.set(key, res);
      return res;
    };
  }

  function memoizeWithTTL(fn, ttlMs = 5 * 60 * 1000) {
    const cache = new Map();
    return function(...args) {
      const key = JSON.stringify(args);
      const now = Date.now();
      const entry = cache.get(key);
      if (entry && entry.expiresAt > now) return entry.value;
      const value = fn.apply(this, args);
      cache.set(key, { value, expiresAt: now + ttlMs });
      return value;
    };
  }

  const FilterCache = {
    _cache: new Map(),
    get(key) {
      return this._cache.get(key) || null;
    },
    set(key, value) {
      this._cache.set(key, value);
    },
    clear() {
      this._cache.clear();
    }
  };

  const Memoization = { memoize, memoizeWithTTL, FilterCache };

  // ===== MODULE LOADER =====
  // Модуль для загрузки и проверки глобальных модулей

  // Преобразование имени модуля в kebab-case
  function toKebabCase(str) {
    if (typeof window !== 'undefined' && window.Utils && typeof window.Utils.toKebab === 'function') {
      return window.Utils.toKebab(str);
    }
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  // Функция для проверки и получения глобального модуля
  function requireGlobalModule(name) {
    if (typeof window === 'undefined' || !window[name]) {
      const file = toKebabCase(name);
      throw new Error(`Модуль ${name} не загружен. Подключите src/js/modules/${file}.js перед RMK2.js`);
    }
    return window[name];
  }

  const ModuleLoader = { requireGlobalModule };

  // ===== RENDER QUEUE =====
  // Батчинг обновлений через requestAnimationFrame.
  // API: schedule(fn), flush(), clear()

  const queue = new Set();
  let pending = false;

  function run() {
    queue.forEach(fn => {
      try { fn(); } catch (e) { window.Logger?.warn('RenderQueue handler error', e); }
    });
    queue.clear();
    pending = false;
  }

  const RenderQueue = {
    schedule(fn) {
      if (typeof fn !== 'function') return;
      queue.add(fn);
      if (!pending) {
        pending = true;
        requestAnimationFrame(run);
      }
    },
    flush() {
      run();
    },
    clear() {
      queue.clear();
      pending = false;
    }
  };

  // Экспорт в window для обратной совместимости
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorHandler, EventManager, Memoization, ModuleLoader, RenderQueue };
  } else if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    window.EventManager = EventManager;
    window.Memoization = Memoization;
    window.ModuleLoader = ModuleLoader;
    window.requireGlobalModule = requireGlobalModule;
    window.RenderQueue = RenderQueue;
  }
})();
