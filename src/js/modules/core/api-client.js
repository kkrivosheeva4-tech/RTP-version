/**
 * Заглушка API-клиента для будущего подключения бэкенда.
 * Единая точка для запросов к API: подстановка Authorization, обработка 401 (refresh/редирект на auth),
 * таймауты, нормализация ошибок. Пока не вызывается из data-loader — только структура и экспорт.
 * См. BACKEND_READINESS_CRITICAL_CHANGES.md.
 */
(function () {
  'use strict';

  function getConfig() {
    if (typeof window !== 'undefined' && window.ApiConfig) {
      return window.ApiConfig;
    }
    return {
      getBaseUrl: function () { return ''; },
      getDefaultTimeout: function () { return 8000; },
      getHeavyTimeout: function () { return 30000; },
      getTokenStorageKey: function () { return 'rmk_access_token'; },
      getRefreshTokenStorageKey: function () { return 'rmk_refresh_token'; }
    };
  }

  /**
   * Выполнить запрос к API.
   * @param {string} method - GET, POST, PUT, PATCH, DELETE
   * @param {string} path - путь относительно базового URL (например '/api/v1/technologies/')
   * @param {object} [options] - { body, query, timeoutMs, skipAuth }
   * @returns {Promise<{ ok: boolean, data?: any, status?: number, error?: string }>}
   */
  function request(method, path, options) {
    var config = getConfig();
    var baseUrl = config.getBaseUrl();
    if (!baseUrl || !baseUrl.trim()) {
      return Promise.resolve({
        ok: false,
        error: 'API_BASE_URL не задан',
        status: 0
      });
    }
    // TODO: собрать URL, добавить Authorization, AbortController+timeout, fetch, обработка 401/refresh, редирект на auth.html
    return Promise.resolve({ ok: false, error: 'API-клиент пока не реализован', status: 0 });
  }

  /**
   * GET запрос.
   * @param {string} path
   * @param {object} [query]
   * @param {object} [options] - { timeoutMs }
   */
  function get(path, query, options) {
    return request('GET', path, Object.assign(options || {}, { query: query }));
  }

  /**
   * POST запрос.
   * @param {string} path
   * @param {object} [body]
   * @param {object} [options]
   */
  function post(path, body, options) {
    return request('POST', path, Object.assign(options || {}, { body: body }));
  }

  /**
   * PUT запрос.
   */
  function put(path, body, options) {
    return request('PUT', path, Object.assign(options || {}, { body: body }));
  }

  /**
   * PATCH запрос.
   */
  function patch(path, body, options) {
    return request('PATCH', path, Object.assign(options || {}, { body: body }));
  }

  /**
   * DELETE запрос.
   */
  function del(path, options) {
    return request('DELETE', path, options);
  }

  var ApiClient = {
    request: request,
    get: get,
    post: post,
    put: put,
    patch: patch,
    delete: del
  };

  if (typeof window !== 'undefined') {
    window.ApiClient = ApiClient;
  }
})();
