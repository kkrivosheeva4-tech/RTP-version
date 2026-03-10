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
  if (!cfg || typeof cfg.getUseApi !== 'function') return false;
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

function storeApiTokens(accessToken, refreshToken, remember) {
  const tokenKey = getTokenKey();
  const refreshKey = getRefreshTokenKey();
  const primary = remember ? localStorage : sessionStorage;
  const secondary = remember ? sessionStorage : localStorage;
  try {
    primary.setItem(tokenKey, accessToken);
    primary.setItem(refreshKey, refreshToken);
  } catch (_) {}
  try {
    secondary.removeItem(tokenKey);
    secondary.removeItem(refreshKey);
  } catch (_) {}
}

function storeLoggedInUser(username, role) {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('username', username);
  localStorage.setItem('role', role);
}

let qrCodeLibPromise = null;

async function getQrCodeLib() {
  if (qrCodeLibPromise) return qrCodeLibPromise;
  qrCodeLibPromise = import('qrcode')
    .then((mod) => mod.default || mod)
    .catch(() => null);
  return qrCodeLibPromise;
}

async function buildQrVisual(qrPayload) {
  if (!qrPayload) return { qrDataUrl: '', qrSvg: '', qrImageUrl: '' };
  const qrLib = await getQrCodeLib();
  if (qrLib) {
    try {
      const qrDataUrl = await qrLib.toDataURL(qrPayload, { width: 200, margin: 1 });
      return { qrDataUrl, qrSvg: '', qrImageUrl: '' };
    } catch (_) {
      try {
        const qrSvg = await qrLib.toString(qrPayload, { type: 'svg', margin: 1, width: 200 });
        return { qrDataUrl: '', qrSvg, qrImageUrl: '' };
      } catch (_) {
        // continue to external fallback
      }
    }
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=1&data=${encodeURIComponent(qrPayload)}`;
  return { qrDataUrl: '', qrSvg: '', qrImageUrl };
}

async function apiLoadMe(accessToken, pending) {
  const baseUrl = getApiBaseUrl(pending);
  if (!baseUrl || !accessToken) return null;
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch (_) {
    return null;
  }
}

/** Mock secret для проверки кода (тот же, что при настройке) */
const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

/**
 * Проверка кода 2FA (страница ввода кода при повторном входе).
 * @param {string} code — 6-значный код
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verify2FACode(code) {
  const pending = getAuth2faPending();
  if (!pending) return { success: false, error: 'Сессия истекла. Войдите снова.' };

  if (pending.isApi && pending.session_id && isApiAuthEnabled(pending)) {
    const baseUrl = getApiBaseUrl(pending);
    if (!baseUrl) return { success: false, error: 'API_BASE_URL не задан' };

    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: pending.session_id, code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: data.error || data.detail || 'Ошибка проверки кода.' };
      }

      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;
      if (!accessToken || !refreshToken) {
        return { success: false, error: 'Некорректный ответ сервера 2FA.' };
      }

      storeApiTokens(accessToken, refreshToken, pending.remember === true);
      const me = await apiLoadMe(accessToken, pending);
      const username = (me && me.username) || pending.username;
      const role = (me && me.role) || pending.role || 'user';
      storeLoggedInUser(username, role);
      sessionStorage.removeItem('auth2faPending');
      return { success: true };
    } catch (_) {
      return { success: false, error: 'Сервер недоступен' };
    }
  }

  if (code === '123456') {
    try {
      storeLoggedInUser(pending.username, pending.role || 'user');
      sessionStorage.removeItem('auth2faPending');
    } catch (_) {
      return { success: false, error: 'Ошибка сохранения сессии' };
    }
    return { success: true };
  }

  try {
    const valid = await verifyTOTPWithWebCrypto(MOCK_TOTP_SECRET, code, 90);
    if (!valid) return { success: false, error: 'Неверный код. Попробуйте снова.' };
    try {
      storeLoggedInUser(pending.username, pending.role || 'user');
      sessionStorage.removeItem('auth2faPending');
    } catch (_) {
      return { success: false, error: 'Ошибка сохранения сессии' };
    }
    return { success: true };
  } catch (_) {
    return { success: false, error: 'Ошибка проверки кода.' };
  }
}

/**
 * Настройка 2FA — получение QR и secret.
 * @returns {Promise<{ qrDataUrl: string, qrSvg: string, qrImageUrl: string, secret: string }>}
 */
export async function setup2FA() {
  const pending = getAuth2faPending();

  if (pending && pending.isApi && pending.session_id && isApiAuthEnabled(pending)) {
    const baseUrl = getApiBaseUrl(pending);
    if (!baseUrl) throw new Error('API_BASE_URL не задан');

    const response = await fetch(`${baseUrl}/api/v1/auth/2fa/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: pending.session_id })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.detail || 'Ошибка загрузки параметров 2FA');
    }

    const secret = String(data.secret || '');
    const qrPayload = String(data.qr_url || '');
    const qr = await buildQrVisual(qrPayload);
    return { qrDataUrl: qr.qrDataUrl, qrSvg: qr.qrSvg, qrImageUrl: qr.qrImageUrl, secret };
  }

  await new Promise((r) => setTimeout(r, 300));
  const secret = MOCK_TOTP_SECRET;
  const issuer = 'Radar';
  const account = 'user';
  const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  const qr = await buildQrVisual(otpauth);
  if (!qr.qrDataUrl && !qr.qrSvg) {
    return {
      qrDataUrl: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#f0f0f0"/><text x="80" y="80" text-anchor="middle" fill="#666" font-size="12">Ошибка генерации QR</text></svg>'
      ),
      qrSvg: '',
      qrImageUrl: '',
      secret
    };
  }
  return { qrDataUrl: qr.qrDataUrl, qrSvg: qr.qrSvg, qrImageUrl: qr.qrImageUrl, secret };
}

/**
 * Завершить вход после успешной проверки 2FA (mock-flow).
 * @returns {boolean}
 */
export function completeLoginFrom2faPending() {
  const pending = getAuth2faPending();
  if (!pending || pending.isApi) return false;
  try {
    storeLoggedInUser(pending.username, pending.role || 'user');
    sessionStorage.removeItem('auth2faPending');
    return true;
  } catch {
    return false;
  }
}

/** Ключ localStorage для флага «2FA настроена» (mock) */
const STORAGE_KEY_2FA_SETUP = '2fa_setup_usernames';

export function has2faSetupComplete(username) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_2FA_SETUP);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(username);
  } catch {
    return false;
  }
}

export function mark2faSetupComplete(username) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_2FA_SETUP);
    const list = raw ? (JSON.parse(raw) || []) : [];
    if (!Array.isArray(list)) return;
    if (!list.includes(username)) {
      list.push(username);
      localStorage.setItem(STORAGE_KEY_2FA_SETUP, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
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
 * @param {string} [secret] — секрет TOTP (для mock-проверки)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function confirm2FASetup(code, secret) {
  const pending = getAuth2faPending();
  if (pending && pending.isApi && pending.session_id && isApiAuthEnabled(pending)) {
    return verify2FACode(code);
  }

  if (code === '123456') return { success: true };
  if (secret) {
    try {
      const valid = await verifyTOTPWithWebCrypto(secret, code, 90);
      return { success: valid, error: valid ? undefined : 'Неверный код. Попробуйте снова.' };
    } catch (_) {
      return { success: false, error: 'Ошибка проверки кода.' };
    }
  }
  return { success: false, error: 'Неверный код. Попробуйте снова.' };
}
