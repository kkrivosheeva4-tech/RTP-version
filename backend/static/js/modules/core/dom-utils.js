// dom-utils.js — ES module
// DOM: кэширование и Proxy-объекты

const elements = {};

function normalizeKey(key) {
    return key && !key.startsWith('#') ? `#${key}` : key;
}

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

function createDOMGetter(id) {
  return () => DOMCache.get(id);
}

function createDOMProxy(id) {
  return createProxy(id, ['querySelector', 'querySelectorAll', 'appendChild', 'getBoundingClientRect']);
}

function createElementProxy(id) {
  return createProxy(id, [
    'addEventListener', 'removeEventListener', 'checked', 'value',
    'style', 'classList', 'textContent', 'innerHTML'
  ]);
}

const DOMProxy = {
    createDOMGetter,
    createDOMProxy,
  createElementProxy
};

function escapeHtmlDom(str) {
  if (str == null) return '';
  const text = String(str);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (typeof window !== 'undefined') {
  window.DOMCache = DOMCache;
  window.DOMProxy = DOMProxy;
  window.createDOMGetter = createDOMGetter;
  window.createDOMProxy = createDOMProxy;
  window.createElementProxy = createElementProxy;
}

export { DOMCache, DOMProxy, createDOMGetter, createDOMProxy, createElementProxy, escapeHtmlDom };
export default { DOMCache, DOMProxy, escapeHtmlDom };
