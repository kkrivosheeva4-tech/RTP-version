// @ts-check
// E2E: Загрузка радара — шаг 10.5

const { test, expect } = require('@playwright/test');

test.describe('Загрузка радара', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/pages/auth.html');
    await page.fill('#username', 'architect');
    await page.fill('#password', 'architect123');
    await page.click('#submitBtn');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('радар загружается и отображает SVG', async ({ page }) => {
    await page.goto('/src/pages/radar.html');

    await expect(page.locator('#techRadar')).toBeVisible({ timeout: 15000 });
    const svg = page.locator('#techRadar');
    await expect(svg).toHaveAttribute('viewBox', /^\d+\s+\d+\s+\d+\s+\d+$/);
  });

  test('кнопка добавления технологии видна для architect', async ({ page }) => {
    await page.goto('/src/pages/radar.html');

    await page.waitForSelector('#techRadar', { state: 'visible', timeout: 15000 });

    const addIconBtn = page.getByRole('button', { name: 'Добавить' });
    await expect(addIconBtn).toBeVisible({ timeout: 15000 });
  });
});
