// dom-utils.js
// Объединенный модуль для работы с DOM: кэширование и Proxy-объекты
// Объединяет функциональность dom-cache.js и dom-proxy.js

(function() {
  'use strict';

  // ===== DOM CACHE =====
  // Кэширует селекторы и элементы, чтобы снизить количество DOM-запросов.
  // API: get(id), query(selector), queryAll(selector, context), find(parent, selector), findAll(parent, selector), clear(key), clearAll(), refresh(id|selector)

  const elements = {};

  // Нормализация ключа для ID
  function normalizeKey(key) {
    return key && !key.startsWith('#') ? `#${key}` : key;
  }

  // Получение ключа для parent элемента
  function getParentKey(parent) {
    if (!parent) return 'parent';
    if (parent.id) return parent.id;
    if (parent.dataset) {
      return parent.dataset.filter || parent.dataset.field || parent.dataset.id || null;
    }
    return parent.className || parent.tagName || 'parent';
  }

  const DOMCache = {
    get(id) {
      if (!id) return null;
      const key = normalizeKey(id);
      // Важно: некоторые элементы (например, динамические поля в модалках)
      // пересоздаются через innerHTML = '' → старые ноды "отваливаются".
      // DOMCache не должен возвращать устаревшие ссылки.
      if (elements[key] && elements[key].isConnected === false) {
        elements[key] = null;
      }
      if (!elements[key]) elements[key] = document.getElementById(id);
      return elements[key];
    },

    query(selector) {
      if (!selector) return null;
      if (!elements[selector]) {
        elements[selector] = document.querySelector(selector);
      }
      return elements[selector];
    },

    queryAll(selector, context = document) {
      if (!selector) return [];
      return context.querySelectorAll(selector);
    },

    find(parent, selector) {
      if (!parent || !selector) return null;
      const parentKey = getParentKey(parent);
      const key = `${parentKey}:${selector}`;
      if (!elements[key]) {
        elements[key] = parent.querySelector(selector);
      }
      return elements[key];
    },

    findAll(parent, selector) {
      if (!parent || !selector) return [];
      return parent.querySelectorAll(selector);
    },

    clear(key) {
      if (key) {
        const normalizedKey = normalizeKey(key);
        delete elements[normalizedKey];
      }
    },

    clearAll() {
      Object.keys(elements).forEach(k => delete elements[k]);
    },

    refresh(id, selector) {
      if (id) {
        const key = normalizeKey(id);
        elements[key] = document.getElementById(id);
        return elements[key];
      }
      if (selector) {
        elements[selector] = document.querySelector(selector);
        return elements[selector];
      }
      return null;
    }
  };

  // ===== DOM PROXY =====
  // Модуль для создания Proxy-объектов для DOM-элементов

  // Безопасные значения для отсутствующих элементов
  const safeDefaults = {
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    checked: false,
    value: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    textContent: '',
    innerHTML: ''
  };

  // Создание Proxy для элемента
  function createProxy(id, safeProps = []) {
    return new Proxy({}, {
      get(target, prop) {
        const el = DOMCache.get(id);
        if (!el) {
          return safeProps.includes(prop) ? safeDefaults[prop] : null;
        }
        const value = el[prop];
        return typeof value === 'function' ? value.bind(el) : value;
      },
      set(target, prop, value) {
        const el = DOMCache.get(id);
        if (el) {
          el[prop] = value;
          return true;
        }
        return false;
      }
    });
  }

  // Создаем функции-геттеры, которые возвращают элементы через DOMCache
  function createDOMGetter(id) {
    return () => DOMCache.get(id);
  }

  // Для элементов, которые используются как объекты (svg, detailPanel)
  function createDOMProxy(id) {
    return createProxy(id, ['querySelector', 'querySelectorAll', 'appendChild', 'getBoundingClientRect']);
  }

  // Helper для создания Proxy с правильной обработкой отсутствующих элементов
  function createElementProxy(id) {
    return createProxy(id, [
      'addEventListener', 'removeEventListener', 'checked', 'value',
      'style', 'classList', 'textContent', 'innerHTML'
    ]);
  }

  // Экспорт DOMProxy
  const DOMProxy = {
    createDOMGetter,
    createDOMProxy,
    createElementProxy
  };

  // Экспорт в window для обратной совместимости
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DOMCache, DOMProxy };
  } else if (typeof window !== 'undefined') {
    window.DOMCache = DOMCache;
    window.DOMProxy = DOMProxy;
    // Глобальные алиасы для обратной совместимости
    window.createDOMGetter = createDOMGetter;
    window.createDOMProxy = createDOMProxy;
    window.createElementProxy = createElementProxy;
  }
})();
