// @ts-check
// E2E: Radar loading

const { test, expect } = require('@playwright/test');
const { loginAsArchitect } = require('./helpers/auth');

async function openRadar(page) {
  await page.goto('/src/pages/radar.html', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  await expect(page.locator('#techRadar')).toBeVisible({ timeout: 15000 });
}

test.describe('Загрузка радара', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsArchitect(page);
  });

  test('радар загружается и отображает SVG', async ({ page }) => {
    await openRadar(page);

    const svg = page.locator('#techRadar');
    await expect(svg).toHaveAttribute('viewBox', /^\d+\s+\d+\s+\d+\s+\d+$/);
  });

  test('кнопка добавления технологии видна для architect', async ({ page }) => {
    await openRadar(page);

    const addIconBtn = page.getByRole('button', { name: /\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c/ }).first();
    await expect(addIconBtn).toBeVisible({ timeout: 15000 });
  });
});
