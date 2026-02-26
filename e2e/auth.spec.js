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
    await expect(page.locator('.notification, #notificationPanel .notification').filter({ hasText: /неверн|парол/i })).toBeVisible({ timeout: 3000 });
  });
});
