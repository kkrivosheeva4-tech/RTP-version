/**
 * API 2FA: заглушки для verify и setup.
 * В будущем — вызовы POST /api/v1/auth/2fa/verify/ и /setup/
 */

import QRCode from 'qrcode';

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

/** Mock secret для проверки кода (тот же, что при настройке) */
const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

/**
 * Проверка кода 2FA (страница ввода кода при повторном входе).
 * Mock: 123456 или TOTP-код из приложения.
 * @param {string} code — 6-значный код
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verify2FACode(code) {
  const pending = getAuth2faPending();
  if (!pending) {
    return { success: false, error: 'Сессия истекла. Войдите снова.' };
  }
  if (code === '123456') {
    try {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', pending.username);
      localStorage.setItem('role', pending.role);
      sessionStorage.removeItem('auth2faPending');
    } catch (e) {
      return { success: false, error: 'Ошибка сохранения сессии' };
    }
    return { success: true };
  }
  try {
    const valid = await verifyTOTPWithWebCrypto(MOCK_TOTP_SECRET, code, 90);
    if (valid) {
      try {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', pending.username);
        localStorage.setItem('role', pending.role);
        sessionStorage.removeItem('auth2faPending');
      } catch (e) {
        return { success: false, error: 'Ошибка сохранения сессии' };
      }
      return { success: true };
    }
  } catch (e) {
    return { success: false, error: 'Ошибка проверки кода.' };
  }
  return { success: false, error: 'Неверный код. Попробуйте снова.' };
}

/**
 * Настройка 2FA — получение QR и secret.
 * Заглушка: возвращает mock данные. QR генерируется реально и сканируется приложениями.
 * @returns {Promise<{ qrDataUrl: string, secret: string }>}
 */
export async function setup2FA() {
  await new Promise((r) => setTimeout(r, 300));
  const secret = 'JBSWY3DPEHPK3PXP';
  const issuer = 'Radar';
  const account = 'user';
  const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  let qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(otpauth, { width: 200, margin: 1 });
  } catch (e) {
    qrDataUrl = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#f0f0f0"/><text x="80" y="80" text-anchor="middle" fill="#666" font-size="12">Ошибка генерации QR</text></svg>'
    );
  }
  return { qrDataUrl, secret };
}

/**
 * Завершить вход после успешной проверки 2FA (использует auth2faPending).
 * @returns {boolean} true если вход завершён, false если нет ожидающей сессии
 */
export function completeLoginFrom2faPending() {
  const pending = getAuth2faPending();
  if (!pending) return false;
  try {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', pending.username);
    localStorage.setItem('role', pending.role);
    sessionStorage.removeItem('auth2faPending');
    return true;
  } catch {
    return false;
  }
}

/** Ключ localStorage для флага «2FA настроена» */
const STORAGE_KEY_2FA_SETUP = '2fa_setup_usernames';

/**
 * Проверить, настроил ли пользователь 2FA (уже сканировал QR).
 * @param {string} username
 * @returns {boolean}
 */
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

/**
 * Сохранить, что пользователь завершил настройку 2FA.
 * @param {string} username
 */
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
 * @returns {{ username: string, role: string, token: string } | null}
 */
export function getAuth2faPending() {
  try {
    const raw = sessionStorage.getItem('auth2faPending');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.username && data.role ? data : null;
  } catch {
    return null;
  }
}

/**
 * Подтверждение настройки 2FA кодом из приложения.
 * При переданном secret — проверка через TOTP (Web Crypto API).
 * Без secret — mock: успех при коде "123456".
 * @param {string} code — 6-значный код
 * @param {string} [secret] — секрет TOTP (для проверки кода из приложения)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function confirm2FASetup(code, secret) {
  if (code === '123456') return { success: true };
  if (secret) {
    try {
      const valid = await verifyTOTPWithWebCrypto(secret, code, 90);
      return { success: valid, error: valid ? undefined : 'Неверный код. Попробуйте снова.' };
    } catch (e) {
      return { success: false, error: 'Ошибка проверки кода.' };
    }
  }
  return { success: false, error: 'Неверный код. Попробуйте снова.' };
}
