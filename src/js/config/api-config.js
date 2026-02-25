/**
 * Конфигурация API бэкенда.
 * ES module (шаг 7.5).
 */
  /** Базовый URL API (для разработки — localhost; для прода — подставить при сборке или через .local) */
  var API_BASE_URL = typeof window !== 'undefined' && window.API_BASE_URL != null
    ? window.API_BASE_URL
    : '';

  /** Таймаут запросов по умолчанию (мс). Согласован с типичным fetch в data-loader. */
  var DEFAULT_TIMEOUT_MS = 8000;

  /** Таймаут для «тяжёлых» запросов (экспорт, большие списки), мс */
  var HEAVY_REQUEST_TIMEOUT_MS = 30000;

  /** Ключ в localStorage для access-токена (при переходе на JWT) */
  var TOKEN_STORAGE_KEY = 'rmk_access_token';

  /** Ключ для refresh-токена */
  var REFRESH_TOKEN_STORAGE_KEY = 'rmk_refresh_token';

  var ApiConfig = {
    getBaseUrl: function () { return API_BASE_URL; },
    getDefaultTimeout: function () { return DEFAULT_TIMEOUT_MS; },
    getHeavyTimeout: function () { return HEAVY_REQUEST_TIMEOUT_MS; },
    getTokenStorageKey: function () { return TOKEN_STORAGE_KEY; },
    getRefreshTokenStorageKey: function () { return REFRESH_TOKEN_STORAGE_KEY; }
  };

  if (typeof window !== 'undefined') {
    window.ApiConfig = ApiConfig;
  }
export {};
