/**
 * API-клиент для работы с backend.
 * ES module (шаг 7.5). Шаг 10.2: полная реализация request, 401/refresh, нормализация ошибок.
 */

function getConfig() {
  if (typeof window !== 'undefined' && window.ApiConfig) {
    return window.ApiConfig;
  }
  return {
    getBaseUrl: () => '',
    getDefaultTimeout: () => 8000,
    getHeavyTimeout: () => 30000,
    getTokenStorageKey: () => 'rmk_access_token',
    getRefreshTokenStorageKey: () => 'rmk_refresh_token'
  };
}

/** Путь для refresh токена (может быть переопределён через window.API_REFRESH_PATH) */
const DEFAULT_REFRESH_PATH = '/api/v1/auth/refresh';

/** URL для редиректа при 401 после неудачного refresh */
const AUTH_PAGE = '/src/pages/auth.html';

function getStorage() {
  if (typeof window === 'undefined') return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  try {
    return localStorage;
  } catch (_) {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

function getSessionStorage() {
  if (typeof window === 'undefined') return { getItem: () => null };
  try {
    return sessionStorage;
  } catch (_) {
    return { getItem: () => null };
  }
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
  const config = getConfig();
  const baseUrl = config.getBaseUrl();
  if (!baseUrl || !baseUrl.trim()) return null;

  const storage = getStorage();
  const refreshKey = config.getRefreshTokenStorageKey();
  const tokenKey = config.getTokenStorageKey();
  const refreshToken = storage.getItem(refreshKey);
  if (!refreshToken) return null;

  const refreshPath = (typeof window !== 'undefined' && window.API_REFRESH_PATH) || DEFAULT_REFRESH_PATH;
  const url = buildUrl(baseUrl, refreshPath);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.getDefaultTimeout());

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + refreshToken
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      storage.removeItem(tokenKey);
      storage.removeItem(refreshKey);
      return null;
    }

    const json = await res.json().catch(() => ({}));
    const newAccess = json.access_token || json.accessToken;
    const newRefresh = json.refresh_token || json.refreshToken;
    if (newAccess) {
      storage.setItem(tokenKey, newAccess);
      if (newRefresh) storage.setItem(refreshKey, newRefresh);
      return newAccess;
    }
  } catch (_) {
    clearTimeout(timeoutId);
    storage.removeItem(tokenKey);
    storage.removeItem(refreshKey);
  }
  return null;
}

/**
 * Редирект на страницу авторизации и очистка токенов.
 */
function redirectToAuth() {
  const config = getConfig();
  const storage = getStorage();
  storage.removeItem(config.getTokenStorageKey());
  storage.removeItem(config.getRefreshTokenStorageKey());
  if (typeof window !== 'undefined' && window.location) {
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = AUTH_PAGE + (returnTo && returnTo !== '/' ? '?return=' + encodeURIComponent(returnTo) : '');
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
    error = data.message || data.error || data.detail || (typeof data.detail === 'string' ? data.detail : error);
    if (Array.isArray(data.detail)) {
      error = data.detail.map(d => d.msg || d.message || String(d)).join('; ') || error;
    }
  } else if (typeof data === 'string') {
    error = data;
  }
  return { ok: false, error: String(error || 'Ошибка запроса'), status: status || (res ? res.status : 0) };
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

  const opts = options || {};
  const query = opts.query;
  const body = opts.body;
  const skipAuth = opts.skipAuth === true;
  const isHeavy = opts.isHeavy === true;
  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : (isHeavy ? config.getHeavyTimeout() : config.getDefaultTimeout());

  const url = buildUrl(baseUrl, path, query);

  const headers = {};
  if (!skipAuth) {
    const storage = getStorage();
    const sess = getSessionStorage();
    const tokenKey = config.getTokenStorageKey();
    let token = storage.getItem(tokenKey) || sess.getItem(tokenKey);
    if (token) headers['Authorization'] = 'Bearer ' + token;
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
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === 'AbortError') {
      return { ok: false, error: 'Таймаут запроса', status: 0 };
    }
    return { ok: false, error: (err && err.message) ? err.message : 'Сетевая ошибка', status: 0 };
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

  if (res.status === 401 && !skipAuth) {
    const newToken = await tryRefreshToken();
    if (newToken) {
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
  const opts = (options && typeof options === 'object') ? { ...options } : {};
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
  const opts = (options && typeof options === 'object') ? { ...options } : {};
  if (body !== undefined) opts.body = body;
  return request('POST', path, opts);
}

/**
 * PUT запрос.
 */
function put(path, body, options) {
  const opts = (options && typeof options === 'object') ? { ...options } : {};
  if (body !== undefined) opts.body = body;
  return request('PUT', path, opts);
}

/**
 * PATCH запрос.
 */
function patch(path, body, options) {
  const opts = (options && typeof options === 'object') ? { ...options } : {};
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
