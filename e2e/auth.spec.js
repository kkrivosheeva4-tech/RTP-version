// @ts-check
// E2E: Логин (mock) — шаг 10.5

const { test, expect } = require('@playwright/test');

test.describe('Логин (mock)', () => {
  test('успешный вход architect и редирект на главную', async ({ page }) => {
    await page.goto('/src/pages/auth.html');

    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();

    await page.fill('#username', 'architect');
    await page.fill('#password', 'architect123');
    await page.click('#submitBtn');

    // 2FA обязательна для всех ролей: перенаправление на настройку или проверку кода
    await page.waitForURL(/\/(auth-2fa-setup|auth-2fa-verify|index)\.html/, { timeout: 5000 });
    if (page.url().includes('auth-2fa-setup')) {
      await expect(page.locator('#setupCode')).toBeVisible({ timeout: 5000 });
      await page.fill('#setupCode', '123456');
      await page.click('#submitBtn');
    } else if (page.url().includes('auth-2fa-verify')) {
      await expect(page.locator('#code2fa')).toBeVisible({ timeout: 5000 });
      await page.fill('#code2fa', '123456');
      await page.click('#submitBtn');
    }

    await expect(page).toHaveURL(/index\.html/);
    await expect(page.locator('.logo')).toBeVisible();
  });

  test('неверный пароль — остаётся на странице входа', async ({ page }) => {
    await page.goto('/src/pages/auth.html');

    await page.fill('#username', 'architect');
    await page.fill('#password', 'wrongpass');
    await page.click('#submitBtn');

    await expect(page).toHaveURL(/auth\.html/);
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.getByText(/Неверное имя пользователя или пароль/i)).toBeVisible({ timeout: 5000 });
  });
});
