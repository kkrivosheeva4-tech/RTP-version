// logger.js — ES module
// Обертка для логирования с проверкой окружения (dev/prod)
// Предотвращает вывод логов в production для улучшения производительности

/**
 * Определяет, находится ли приложение в режиме разработки
 * @returns {boolean} true, если dev режим
 */
export function isDevMode() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  if (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local')) {
    return true;
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('dev') === 'true') return true;
  const devMeta = document.querySelector('meta[name="app-mode"]');
  if (devMeta && devMeta.content === 'development') return true;
  return false;
}

const DEV_MODE = typeof window !== 'undefined' ? isDevMode() : false;

/**
 * Обертка для console.log
 */
export function log(...args) {
  if (DEV_MODE) console.log(...args);
}

/**
 * Обертка для console.error
 */
export function error(...args) {
  if (DEV_MODE) {
    console.error(...args);
  } else {
    console.error(...args);
  }
}

/**
 * Обертка для console.warn
 */
export function warn(...args) {
  if (DEV_MODE) console.warn(...args);
}

/**
 * Обертка для console.debug
 */
export function debug(...args) {
  if (DEV_MODE) console.debug(...args);
}

/**
 * Обертка для console.info
 */
export function info(...args) {
  if (DEV_MODE) console.info(...args);
}

/**
 * Группировка логов (только в dev)
 */
export function group(...args) {
  if (DEV_MODE) console.group(...args);
}

/**
 * Закрытие группы (только в dev)
 */
export function groupEnd() {
  if (DEV_MODE) console.groupEnd();
}

/**
 * Группировка логов с коллапсом (только в dev)
 */
export function groupCollapsed(...args) {
  if (DEV_MODE) console.groupCollapsed(...args);
}

const Logger = {
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

// Обратная совместимость: экспорт в window до перевода остальных модулей на ES imports
if (typeof window !== 'undefined') {
  window.Logger = Logger;
}

export default Logger;
