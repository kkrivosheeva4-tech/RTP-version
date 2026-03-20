// @ts-check
// E2E: Логин через Django/API baseline

const { test, expect } = require('@playwright/test');
const { configureApiAuthMode, loginAsOwner } = require('./helpers/auth');

test.describe('Логин через Django/API', () => {
  test('успешный вход owner и редирект на главную', async ({ page }) => {
    await loginAsOwner(page);
    await expect(page).toHaveURL(/index\.html/);
    await expect(page.locator('.logo')).toBeVisible();
  });

  test('неверный пароль — остаётся на странице входа', async ({ page }) => {
    await configureApiAuthMode(page);
    await page.goto('/src/pages/auth.html', { waitUntil: 'domcontentloaded' });

    await page.fill('#username', 'owner');
    await page.fill('#password', 'wrongpass');
    await page.click('#submitBtn');

    await expect(page).toHaveURL(/auth\.html/);
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#submitBtn')).toBeEnabled({ timeout: 15000 });
  });
});
