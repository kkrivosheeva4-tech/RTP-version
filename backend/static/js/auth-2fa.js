/** Base32 decode (RFC 4648) */
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  str = str.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of str) {
    const v = alphabet.indexOf(char);
    if (v === -1) throw new Error('Invalid Base32');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

/** Проверка TOTP кода через Web Crypto API (RFC 6238) */
async function verifyTOTPWithWebCrypto(secretBase32, token, windowSeconds = 30) {
  const secret = base32Decode(secretBase32);
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const epoch = Math.floor(Date.now() / 1000);
  const period = 30;
  const steps = Math.floor(windowSeconds / period) || 1;
  for (let delta = -steps; delta <= steps; delta++) {
    const counter = Math.floor(epoch / period) + delta;
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setUint32(4, counter, false);
    const sig = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const hmac = new Uint8Array(sig);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    const code = String((binary >>> 0) % 1000000).padStart(6, '0');
    if (code === token) return true;
  }
  return false;
}

function getApiConfig() {
  if (typeof window !== 'undefined' && window.ApiConfig) return window.ApiConfig;
  return null;
}

function isApiAuthEnabled(pending) {
  if (pending && pending.isApi === true) return true;
  const cfg = getApiConfig();
  if (!cfg || typeof cfg.getUseApi !== 'function') return true;
  return cfg.getUseApi() === true;
}

function getApiBaseUrl(pending) {
  if (pending && typeof pending.api_base_url === 'string' && pending.api_base_url.trim()) {
    return pending.api_base_url.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.trim()) {
    return window.API_BASE_URL.trim().replace(/\/$/, '');
  }
  const cfg = getApiConfig();
  if (cfg && typeof cfg.getBaseUrl === 'function') {
    const url = String(cfg.getBaseUrl() || '').trim();
    if (url) return url.replace(/\/$/, '');
  }
  return '';
}

function getTokenKey() {
  const cfg = getApiConfig();
  if (cfg && typeof cfg.getTokenStorageKey === 'function') return cfg.getTokenStorageKey();
  return 'rmk_access_token';
}

function getRefreshTokenKey() {
  const cfg = getApiConfig();
  if (cfg && typeof cfg.getRefreshTokenStorageKey === 'function') return cfg.getRefreshTokenStorageKey();
  return 'rmk_refresh_token';
}

function isRefreshCookieMode() {
  const cfg = getApiConfig();
  if (!cfg || typeof cfg.getUseRefreshCookieAuth !== 'function') return true;
  return cfg.getUseRefreshCookieAuth() === true;
}

function storeApiTokens(accessToken, refreshToken, remember) {
  void refreshToken;
  void remember;
  if (window.ApiClient && typeof window.ApiClient.setAccessToken === 'function') {
    window.ApiClient.setAccessToken(accessToken);
  }
  const tokenKey = getTokenKey();
  const refreshKey = getRefreshTokenKey();
  try {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(refreshKey);
    sessionStorage.setItem(tokenKey, accessToken);
    sessionStorage.removeItem(refreshKey);
  } catch (_) {}
}

function storeLoggedInUser(username, role) {
  if (window.AuthModule && typeof window.AuthModule.setAuthSession === 'function') {
    window.AuthModule.setAuthSession({ username, role, is_2fa_enabled: true }, { clearLegacy: true });
    return;
  }
  // Auth-state не сохраняется в localStorage — используем AuthModule
}

let qrCodeLibPromise = null;

async function getQrCodeLib() {
  if (qrCodeLibPromise) return qrCodeLibPromise;
  qrCodeLibPromise = Promise.resolve(
    typeof window !== 'undefined' && window.QRCode && typeof window.QRCode.toDataURL === 'function'
      ? window.QRCode
      : null
  );
  return qrCodeLibPromise;
}

async function buildQrVisual(qrPayload) {
  if (!qrPayload) return { qrDataUrl: '', qrSvg: '', qrImageUrl: '', qrImageUrlFallback: '' };
  const qrLib = await getQrCodeLib();
  if (qrLib) {
    try {
      const qrDataUrl = await qrLib.toDataURL(qrPayload, { width: 240, margin: 1 });
      return { qrDataUrl, qrSvg: '', qrImageUrl: '', qrImageUrlFallback: '' };
    } catch (_) {
      try {
        const qrSvg = await qrLib.toString(qrPayload, { type: 'svg', margin: 1, width: 240 });
        return { qrDataUrl: '', qrSvg, qrImageUrl: '', qrImageUrlFallback: '' };
      } catch (_) {
        // continue to external fallback
      }
    }
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&data=${encodeURIComponent(qrPayload)}`;
  const qrImageUrlFallback = `https://quickchart.io/qr?size=240&margin=1&text=${encodeURIComponent(qrPayload)}`;
  return { qrDataUrl: '', qrSvg: '', qrImageUrl, qrImageUrlFallback };
}

async function apiLoadMe(accessToken, pending) {
  const baseUrl = getApiBaseUrl(pending);
  if (!baseUrl || !accessToken) return null;
  const useRefreshCookieAuth = isRefreshCookieMode();
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: useRefreshCookieAuth ? 'include' : 'same-origin'
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch (_) {
    return null;
  }
}

/**
 * Проверка кода 2FA (страница ввода кода при повторном входе).
 * @param {string} code — 6-значный код
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verify2FACode(code) {
  const pending = getAuth2faPending();
  if (!pending) return { success: false, error: 'Сессия истекла. Войдите снова.' };
  if (!(pending.isApi && pending.session_id && isApiAuthEnabled(pending))) {
    return { success: false, error: '2FA доступна только через backend API.' };
  }

  const baseUrl = getApiBaseUrl(pending);
  if (!baseUrl) return { success: false, error: 'API_BASE_URL не задан' };
  const useRefreshCookieAuth = isRefreshCookieMode();

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: useRefreshCookieAuth ? 'include' : 'same-origin',
      body: JSON.stringify({ session_id: pending.session_id, code })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data.error || data.detail || 'Ошибка проверки кода.' };
    }

    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    if (!accessToken) {
      return { success: false, error: 'Некорректный ответ сервера 2FA.' };
    }

    storeApiTokens(accessToken, refreshToken, pending.remember === true);
    const me = await apiLoadMe(accessToken, pending);
    const username = (me && me.username) || pending.username;
    const role = (me && me.role) || pending.role || 'user';
    if (window.AuthModule && typeof window.AuthModule.setAuthSession === 'function') {
      window.AuthModule.setAuthSession(
        { username, role, is_2fa_enabled: true },
        { accessToken, clearLegacy: true }
      );
    } else {
      storeLoggedInUser(username, role);
    }
    sessionStorage.removeItem('auth2faPending');
    return { success: true };
  } catch (_) {
    return { success: false, error: 'Сервер недоступен' };
  }
}

/**
 * Настройка 2FA — получение QR и secret.
 * @returns {Promise<{ qrDataUrl: string, qrSvg: string, qrImageUrl: string, qrImageUrlFallback: string, secret: string }>}
 */
export async function setup2FA() {
  const pending = getAuth2faPending();
  if (!(pending && pending.isApi && pending.session_id && isApiAuthEnabled(pending))) {
    throw new Error('2FA setup доступна только через backend API');
  }

  const baseUrl = getApiBaseUrl(pending);
  if (!baseUrl) throw new Error('API_BASE_URL не задан');
  const useRefreshCookieAuth = isRefreshCookieMode();

  const response = await fetch(`${baseUrl}/api/v1/auth/2fa/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: useRefreshCookieAuth ? 'include' : 'same-origin',
    body: JSON.stringify({ session_id: pending.session_id })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Ошибка загрузки параметров 2FA');
  }

  const secret = String(data.secret || '');
  const serverQrSvgUrl = String(data.qr_svg_url || '').trim();
  if (serverQrSvgUrl) {
    const normalizedQrImageUrl = serverQrSvgUrl.startsWith('http')
      ? serverQrSvgUrl
      : `${baseUrl}${serverQrSvgUrl.startsWith('/') ? '' : '/'}${serverQrSvgUrl}`;
    return {
      qrDataUrl: '',
      qrSvg: '',
      qrImageUrl: normalizedQrImageUrl,
      qrImageUrlFallback: '',
      secret
    };
  }
  const qrPayload = String(data.qr_url || '');
  const qr = await buildQrVisual(qrPayload);
  return {
    qrDataUrl: qr.qrDataUrl,
    qrSvg: qr.qrSvg,
    qrImageUrl: qr.qrImageUrl,
    qrImageUrlFallback: qr.qrImageUrlFallback,
    secret
  };
}

/**
 * Завершить вход после успешной проверки 2FA.
 * @returns {boolean}
 */
export function completeLoginFrom2faPending() {
  return false;
}

export function has2faSetupComplete(username) {
  void username;
  return false;
}

export function mark2faSetupComplete(username) {
  void username;
}

/**
 * Получить данные ожидающей 2FA сессии из sessionStorage.
 * @returns {{ username: string, role?: string, token?: string, session_id?: string, api_base_url?: string, remember?: boolean, isApi?: boolean } | null}
 */
export function getAuth2faPending() {
  try {
    const raw = sessionStorage.getItem('auth2faPending');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.username) return null;
    if (!data.token && !data.session_id) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Подтверждение настройки 2FA кодом из приложения.
 * @param {string} code — 6-значный код
 * @param {string} [secret] — зарезервировано для совместимости
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function confirm2FASetup(code, secret) {
  void secret;
  const pending = getAuth2faPending();
  if (!(pending && pending.isApi && pending.session_id && isApiAuthEnabled(pending))) {
    return { success: false, error: '2FA setup доступна только через backend API.' };
  }
  return verify2FACode(code);
}
