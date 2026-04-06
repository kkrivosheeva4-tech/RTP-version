/**
 * API-клиент для работы с backend.
 * ES module (шаг 7.5). Шаг 10.2: полная реализация request, 401/refresh, нормализация ошибок.
 */

function getConfig() {
  if (typeof window !== 'undefined') {
    const fallbackBaseUrl = (() => {
      const explicit = typeof window.API_BASE_URL === 'string' ? window.API_BASE_URL.trim() : '';
      if (explicit) return explicit;
      const isHttpOrigin =
        window.location &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:');
      const isViteDevPort =
        window.location && (window.location.port === '5173' || window.location.port === '5174');
      if (isHttpOrigin && !isViteDevPort) {
        return window.location.origin;
      }
      return '';
    })();

    if (window.ApiConfig) {
      return {
        getBaseUrl: () => {
          const configured =
            typeof window.ApiConfig.getBaseUrl === 'function'
              ? String(window.ApiConfig.getBaseUrl() || '').trim()
              : '';
          return configured || fallbackBaseUrl;
        },
        getUseApi: () => {
          if (typeof window.ApiConfig.getUseApi === 'function') {
            return window.ApiConfig.getUseApi();
          }
          return true;
        },
        getDefaultTimeout: () =>
          typeof window.ApiConfig.getDefaultTimeout === 'function'
            ? window.ApiConfig.getDefaultTimeout()
            : 8000,
        getHeavyTimeout: () =>
          typeof window.ApiConfig.getHeavyTimeout === 'function'
            ? window.ApiConfig.getHeavyTimeout()
            : 30000,
        getTokenStorageKey: () =>
          typeof window.ApiConfig.getTokenStorageKey === 'function'
            ? window.ApiConfig.getTokenStorageKey()
            : 'rmk_access_token',
        getRefreshTokenStorageKey: () =>
          typeof window.ApiConfig.getRefreshTokenStorageKey === 'function'
            ? window.ApiConfig.getRefreshTokenStorageKey()
            : 'rmk_refresh_token',
        getUseRefreshCookieAuth: () =>
          typeof window.ApiConfig.getUseRefreshCookieAuth === 'function'
            ? window.ApiConfig.getUseRefreshCookieAuth()
            : true
      };
    }

    if (fallbackBaseUrl) {
      return {
        getBaseUrl: () => fallbackBaseUrl,
        getUseApi: () => true,
        getDefaultTimeout: () => 8000,
        getHeavyTimeout: () => 30000,
        getTokenStorageKey: () => 'rmk_access_token',
        getRefreshTokenStorageKey: () => 'rmk_refresh_token',
        getUseRefreshCookieAuth: () => true
      };
    }
  }
  return {
    getBaseUrl: () => '',
    getDefaultTimeout: () => 8000,
    getHeavyTimeout: () => 30000,
    getTokenStorageKey: () => 'rmk_access_token',
    getRefreshTokenStorageKey: () => 'rmk_refresh_token',
    getUseRefreshCookieAuth: () => true
  };
}

/** Путь для refresh токена (может быть переопределён через window.API_REFRESH_PATH) */
const DEFAULT_REFRESH_PATH = '/api/v1/auth/refresh';

/** Публичная точка входа для возврата после потери сессии */
const HOME_PAGE = '/';
let refreshInFlightPromise = null;
let runtimeAccessToken = '';
let logoutInProgress = false;
let refreshAbortController = null;

function isPublicLandingPage() {
  if (typeof window === 'undefined' || !window.location) return false;

  const path = String(window.location.pathname || '');
  return path === '/' || path === '/src/pages/index.html';
}

function isAuthFlowPage() {
  if (typeof window === 'undefined' || !window.location) return false;

  const path = String(window.location.pathname || '');
  return (
    path.includes('/auth/login/') ||
    path.includes('/auth/2fa/setup/') ||
    path.includes('/auth/2fa/verify/')
  );
}

function getStorage() {
  if (typeof window === 'undefined')
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  try {
    return localStorage;
  } catch (_) {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

function getSessionStorage() {
  if (typeof window === 'undefined') return { getItem: () => null, removeItem: () => {} };
  try {
    return sessionStorage;
  } catch (_) {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

function readSessionToken(key) {
  const local = getStorage();
  const session = getSessionStorage();
  const sessionValue = session.getItem(key);
  if (sessionValue) {
    return { token: sessionValue, local, session };
  }
  return { token: null, local, session };
}

function clearAuthTokensEverywhere(tokenKey, refreshKey, local, session) {
  clearAccessToken();
  local.removeItem(tokenKey);
  local.removeItem(refreshKey);
  session.removeItem(tokenKey);
  session.removeItem(refreshKey);
}

function setAccessToken(token) {
  runtimeAccessToken = String(token || '').trim();
}

function clearAccessToken() {
  runtimeAccessToken = '';
}

function setLogoutInProgress(value) {
  logoutInProgress = value === true;
  if (logoutInProgress && refreshAbortController) {
    try {
      refreshAbortController.abort();
    } catch (_) {}
  }
}

function getAccessToken(config) {
  if (runtimeAccessToken) {
    return runtimeAccessToken;
  }
  const tokenKey = config.getTokenStorageKey();
  const session = getSessionStorage();
  return session.getItem(tokenKey) || '';
}

function writeRefreshedTokens(
  tokenKey,
  accessToken,
  local,
  session
) {
  setAccessToken(accessToken);

  session.setItem(tokenKey, accessToken);
  local.removeItem(tokenKey);
}

function shouldUseRefreshCookieAuth(config) {
  return Boolean(
    config &&
    typeof config.getUseRefreshCookieAuth === 'function' &&
    config.getUseRefreshCookieAuth() === true
  );
}

function getCookie(name) {
  if (typeof document === 'undefined' || !name) return '';
  const escaped = String(name).replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Строит URL из baseUrl, path и query.
 * @param {string} baseUrl
 * @param {string} path
 * @param {Object} [query]
 */
function buildUrl(baseUrl, path, query) {
  let url = baseUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
  if (query && typeof query === 'object' && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

/**
 * Пытается обновить access-токен через refresh-токен.
 * @returns {Promise<string|null>} новый access-токен или null
 */
async function tryRefreshToken() {
  if (logoutInProgress) {
    return null;
  }
  if (refreshInFlightPromise) {
    return refreshInFlightPromise;
  }

  refreshInFlightPromise = (async () => {
    const config = getConfig();
    const baseUrl = config.getBaseUrl();
    if (!baseUrl || !baseUrl.trim()) return null;
    const refreshKey = config.getRefreshTokenStorageKey();
    const tokenKey = config.getTokenStorageKey();
    const { local, session } = readSessionToken(refreshKey);

    const refreshPath =
      (typeof window !== 'undefined' && window.API_REFRESH_PATH) || DEFAULT_REFRESH_PATH;
    const url = buildUrl(baseUrl, refreshPath);
    const csrfToken = getCookie('csrftoken');
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }

    const controller = new AbortController();
    refreshAbortController = controller;
    const timeoutId = setTimeout(() => controller.abort(), config.getDefaultTimeout());

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (logoutInProgress) {
        return null;
      }

      if (!res.ok) {
        // При невалидном/отозванном refresh очищаем все токены.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          clearAuthTokensEverywhere(tokenKey, refreshKey, local, session);
        }
        return null;
      }

      const json = await res.json().catch(() => ({}));
      const newAccess = json.access_token || json.accessToken;
      if (newAccess) {
        writeRefreshedTokens(
          tokenKey,
          newAccess,
          local,
          session
        );
        return newAccess;
      }
    } catch (_) {
      clearTimeout(timeoutId);
      // Сетевые сбои не должны инвалидировать локальную сессию.
    }
    refreshAbortController = null;
    return null;
  })();

  try {
    return await refreshInFlightPromise;
  } finally {
    refreshInFlightPromise = null;
    refreshAbortController = null;
  }
}

/**
 * Очищает auth-состояние и возвращает пользователя на публичную главную.
 * На публичной главной и auth-страницах навигацию не форсируем.
 */
function redirectToAuth() {
  if (logoutInProgress) {
    return;
  }
  const config = getConfig();
  const local = getStorage();
  const session = getSessionStorage();
  const tokenKey = config.getTokenStorageKey();
  const refreshKey = config.getRefreshTokenStorageKey();

  clearAccessToken();

  // Clear auth artifacts from both storages to prevent redirect loops.
  local.removeItem(tokenKey);
  local.removeItem(refreshKey);
  session.removeItem(tokenKey);
  session.removeItem(refreshKey);
  local.removeItem('isLoggedIn');
  local.removeItem('username');
  local.removeItem('userName');
  local.removeItem('role');

  if (typeof window !== 'undefined' && window.location) {
    if (isPublicLandingPage() || isAuthFlowPage()) {
      return;
    }
    window.location.href = HOME_PAGE;
  }
}

/**
 * Нормализует ответ/ошибку в формат { ok, data?, error?, status }.
 */
function normalizeResponse(res, data, status) {
  if (res && res.ok) {
    return { ok: true, data: data !== undefined ? data : res, status: status || res.status };
  }
  let error = 'Ошибка запроса';
  if (data && typeof data === 'object') {
    error =
      data.message ||
      data.error ||
      data.detail ||
      (typeof data.detail === 'string' ? data.detail : error);
    if (Array.isArray(data.detail)) {
      error = data.detail.map((d) => d.msg || d.message || String(d)).join('; ') || error;
    }
  } else if (typeof data === 'string') {
    error = data;
  }
  return {
    ok: false,
    error: String(error || 'Ошибка запроса'),
    status: status || (res ? res.status : 0)
  };
}

/**
 * Выполнить запрос к API.
 * @param {string} method - GET, POST, PUT, PATCH, DELETE
 * @param {string} path - путь относительно базового URL (напр. '/api/v1/technologies')
 * @param {Object} [options] - { body, query, timeoutMs, skipAuth, isHeavy }
 * @returns {Promise<{ ok: boolean, data?: any, status?: number, error?: string }>}
 */
async function request(method, path, options) {
  const config = getConfig();
  const baseUrl = config.getBaseUrl();
  if (!baseUrl || !baseUrl.trim()) {
    return { ok: false, error: 'API_BASE_URL не задан', status: 0 };
  }
  const useRefreshCookieAuth = shouldUseRefreshCookieAuth(config);

  const opts = options || {};
  const query = opts.query;
  const body = opts.body;
  const skipAuth = opts.skipAuth === true;
  const isHeavy = opts.isHeavy === true;
  const timeoutMs =
    opts.timeoutMs != null
      ? opts.timeoutMs
      : isHeavy
        ? config.getHeavyTimeout()
        : config.getDefaultTimeout();

  const url = buildUrl(baseUrl, path, query);

  const headers = {};
  if (!skipAuth) {
    let token = getAccessToken(config);
    // Cookie-режим: при отсутствии токена (после редиректа) сначала refresh,
    // чтобы не делать первый запрос без токена и не получать 401.
    if (!token && useRefreshCookieAuth && !logoutInProgress) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        setAccessToken(newToken);
        token = newToken;
      }
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  if (useRefreshCookieAuth) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;
  }

  let fetchBody = undefined;
  if (body != null) {
    if (body instanceof FormData) {
      fetchBody = body;
      if (!headers['Content-Type']) delete headers['Content-Type'];
    } else if (body instanceof ArrayBuffer || body instanceof Blob) {
      fetchBody = body;
    } else if (typeof body === 'object' || typeof body === 'string') {
      headers['Content-Type'] = 'application/json';
      fetchBody = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: method.toUpperCase(),
      headers: Object.keys(headers).length ? headers : undefined,
      body: fetchBody,
      credentials: useRefreshCookieAuth ? 'include' : 'same-origin',
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === 'AbortError') {
      return { ok: false, error: 'Таймаут запроса', status: 0 };
    }
    return { ok: false, error: err && err.message ? err.message : 'Сетевая ошибка', status: 0 };
  }
  clearTimeout(timeoutId);

  let data;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
  } else {
    const text = await res.text();
    data = text || null;
  }

  if (res.status === 401 && !skipAuth && !logoutInProgress) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      setAccessToken(newToken);
      return request(method, path, { ...opts, skipAuth: false });
    }
    redirectToAuth();
    return { ok: false, error: 'Требуется авторизация', status: 401 };
  }

  if (!res.ok) {
    return normalizeResponse(res, data, res.status);
  }

  return { ok: true, data: data !== undefined && data !== null ? data : res, status: res.status };
}

/**
 * GET запрос.
 * @param {string} path
 * @param {Object} [query]
 * @param {Object} [options] - { timeoutMs, skipAuth, isHeavy }
 */
function get(path, query, options) {
  const opts = options && typeof options === 'object' ? { ...options } : {};
  if (query != null) opts.query = query;
  return request('GET', path, opts);
}

/**
 * POST запрос.
 * @param {string} path
 * @param {Object|FormData} [body]
 * @param {Object} [options]
 */
function post(path, body, options) {
  const opts = options && typeof options === 'object' ? { ...options } : {};
  if (body !== undefined) opts.body = body;
  return request('POST', path, opts);
}

/**
 * PUT запрос.
 */
function put(path, body, options) {
  const opts = options && typeof options === 'object' ? { ...options } : {};
  if (body !== undefined) opts.body = body;
  return request('PUT', path, opts);
}

/**
 * PATCH запрос.
 */
function patch(path, body, options) {
  const opts = options && typeof options === 'object' ? { ...options } : {};
  if (body !== undefined) opts.body = body;
  return request('PATCH', path, opts);
}

/**
 * DELETE запрос.
 */
function del(path, options) {
  return request('DELETE', path, options || {});
}

const ApiClient = {
  setAccessToken,
  clearAccessToken,
  setLogoutInProgress,
  request,
  get,
  post,
  put,
  patch,
  delete: del
};

if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
}

export { ApiClient };
export default ApiClient;
