/**
 * Конфигурация API бэкенда.
 * ES module (шаг 7.5).
 * Шаг 9.1: добавлены USE_API и флаг переключения mock/API.
 */

/** Базовый URL API (пустой — mock-режим; непустой — использование API). */
var API_BASE_URL =
  typeof window !== 'undefined' && window.API_BASE_URL != null
    ? String(window.API_BASE_URL).trim()
    : '';

/**
 * Fallback для Django-serving режима:
 * если фронтенд открыт не через Vite dev server и явный API_BASE_URL не задан,
 * используем текущий origin как backend origin.
 */
if (typeof window !== 'undefined' && !API_BASE_URL) {
  var isHttpOrigin = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  var isViteDevPort = window.location.port === '5173' || window.location.port === '5174';
  if (isHttpOrigin && !isViteDevPort) {
    API_BASE_URL = window.location.origin;
  }
}

/**
 * Защита от типичной локальной ошибки:
 * если фронтенд запущен на Vite (:5173/:5174) и API_BASE_URL равен origin фронтенда,
 * то API должен идти в Django на :8000.
 */
if (typeof window !== 'undefined' && API_BASE_URL) {
  var isLocalVite =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (window.location.port === '5173' || window.location.port === '5174');
  var isSameAsFrontendOrigin = API_BASE_URL === window.location.origin;
  if (isLocalVite && isSameAsFrontendOrigin) {
    API_BASE_URL = window.location.protocol + '//' + window.location.hostname + ':8000';
  }
}

/**
 * Флаг источника данных: true — API, false — mock (JSON + VFS).
 * Определяется по API_BASE_URL (не пустой → true) или переопределяется через window.USE_API.
 */
var USE_API = (function () {
  if (typeof window !== 'undefined' && typeof window.USE_API === 'boolean') {
    return window.USE_API;
  }
  return API_BASE_URL !== '';
})();

/** Таймаут запросов по умолчанию (мс). Согласован с типичным fetch в data-loader. */
var DEFAULT_TIMEOUT_MS = 8000;

/** Таймаут для «тяжёлых» запросов (экспорт, большие списки), мс */
var HEAVY_REQUEST_TIMEOUT_MS = 30000;

/** Ключ в localStorage для access-токена (при переходе на JWT) */
var TOKEN_STORAGE_KEY = 'rmk_access_token';

/** Ключ для refresh-токена */
var REFRESH_TOKEN_STORAGE_KEY = 'rmk_refresh_token';

/**
 * Флаг cookie-режима для refresh:
 * true — refresh хранится в HttpOnly cookie и НЕ сохраняется в localStorage/sessionStorage;
 * false — legacy-режим с refresh в storage.
 */
var USE_REFRESH_COOKIE_AUTH = (function () {
  if (typeof window !== 'undefined' && typeof window.USE_REFRESH_COOKIE_AUTH === 'boolean') {
    return window.USE_REFRESH_COOKIE_AUTH;
  }
  return USE_API;
})();

var ApiConfig = {
  /** @returns {string} Базовый URL API */
  getBaseUrl: function () {
    return API_BASE_URL;
  },
  /** @returns {boolean} true — использовать API, false — mock (JSON + VFS) */
  getUseApi: function () {
    return USE_API;
  },
  getDefaultTimeout: function () {
    return DEFAULT_TIMEOUT_MS;
  },
  getHeavyTimeout: function () {
    return HEAVY_REQUEST_TIMEOUT_MS;
  },
  getTokenStorageKey: function () {
    return TOKEN_STORAGE_KEY;
  },
  getRefreshTokenStorageKey: function () {
    return REFRESH_TOKEN_STORAGE_KEY;
  },
  getUseRefreshCookieAuth: function () {
    return USE_REFRESH_COOKIE_AUTH;
  }
};

if (typeof window !== 'undefined') {
  window.ApiConfig = ApiConfig;
}
export {};
