// @ts-check

const crypto = require('node:crypto');
const { expect } = require('@playwright/test');

function decodeBase32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(secret || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value === -1) {
      continue;
    }
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret) {
  const key = decodeBase32(secret);
  const counter = Math.floor(Date.now() / 30000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

async function configureApiAuthMode(page) {
  await page.addInitScript(() => {
    try {
      window.USE_API = true;
      window.USE_REFRESH_COOKIE_AUTH = true;
    } catch (_) {
      // ignore
    }
  });
}

async function complete2faIfNeeded(page) {
  await page.waitForURL(/\/(auth-2fa-setup|auth-2fa-verify|index)\.html/, { timeout: 30000 });

  if (page.url().includes('auth-2fa-setup')) {
    await expect(page.locator('#manualSecret')).toBeVisible({ timeout: 10000 });
    const secret = await page.locator('#manualSecret').inputValue();
    const code = generateTotp(secret.trim());
    await page.fill('#setupCode', code);
    await page.click('#submitBtn');
  } else if (page.url().includes('auth-2fa-verify')) {
    await expect(page.locator('#code2fa')).toBeVisible({ timeout: 5000 });
    const pending = await page.evaluate(() => {
      const raw = sessionStorage.getItem('auth2faPending');
      return raw ? JSON.parse(raw) : null;
    });
    if (!pending || !pending.session_id) {
      throw new Error('auth2faPending/session_id is missing');
    }
    const setupResponse = await page.request.post('/api/v1/auth/2fa/setup/', {
      data: { session_id: pending.session_id },
    });
    const setupJson = await setupResponse.json();
    const code = generateTotp(String(setupJson.secret || '').trim());
    await page.fill('#code2fa', code);
    await page.locator('#code2fa').press('Enter');
  }
}

async function loginAsOwner(page) {
  await configureApiAuthMode(page);
  await page.goto('/src/pages/auth.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.fill('#username', 'owner');
  await page.fill('#password', 'owner123');
  await page.click('#submitBtn');

  await complete2faIfNeeded(page);
  await expect(page).toHaveURL(/index\.html/, { timeout: 20000 });
}

module.exports = {
  configureApiAuthMode,
  loginAsOwner,
};
