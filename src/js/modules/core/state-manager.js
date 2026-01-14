// StateManager: простое централизованное состояние с подписками.
// API: get(key), set(key, value), subscribe(fn) -> unsubscribe, subscribeToKey(key, fn) -> unsubscribe, clear()

(function() {
  'use strict';

  const state = {};
  const listeners = new Set();
  const keyListeners = new Map();

  // Безопасный вызов обработчика с обработкой ошибок
  function safeCall(fn, ...args) {
    try {
      fn(...args);
    } catch (e) {
      console.error('StateManager listener error', e);
    }
  }

  const StateManager = {
    get(key) {
      return state[key];
    },

    set(key, value) {
      const oldValue = state[key];
      if (oldValue === value) return; // Пропускаем, если значение не изменилось

      state[key] = value;

      // Уведомляем глобальных подписчиков
      listeners.forEach(fn => safeCall(fn, key, value, oldValue));

      // Уведомляем подписчиков на конкретный ключ
      const keySubscribers = keyListeners.get(key);
      if (keySubscribers) {
        keySubscribers.forEach(fn => safeCall(fn, value, oldValue, key));
      }
    },

    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    subscribeToKey(key, fn) {
      if (typeof fn !== 'function') return () => {};

      if (!keyListeners.has(key)) {
        keyListeners.set(key, new Set());
      }
      keyListeners.get(key).add(fn);

      return () => {
        const subscribers = keyListeners.get(key);
        if (subscribers) {
          subscribers.delete(fn);
          if (subscribers.size === 0) {
            keyListeners.delete(key);
          }
        }
      };
    },

    clear() {
      Object.keys(state).forEach(k => delete state[k]);
      listeners.clear();
      keyListeners.clear();
    }
  };

  // Экспорт в window
  if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
  }
})();
