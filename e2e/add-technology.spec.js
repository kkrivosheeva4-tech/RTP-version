// @ts-check
// E2E: Добавление технологии (mock API) — шаг 10.5

const { test, expect } = require('@playwright/test');

/** Выбрать первую опцию в кастомном селекте по data-field */
async function selectFirstOption(page, dataField) {
  const select = page.locator(`.custom-select-modal[data-field="${dataField}"]`);
  await select.waitFor({ state: 'visible', timeout: 5000 });
  await select.locator('.select-trigger').click();
  await page.waitForTimeout(300);
  const firstOption = select.locator('.select-options li').first();
  await firstOption.waitFor({ state: 'visible', timeout: 3000 });
  await firstOption.click();
}

test.describe('Добавление технологии (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/pages/auth.html');
    await page.fill('#username', 'architect');
    await page.fill('#password', 'architect123');
    await page.click('#submitBtn');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('открывает форму добавления и сохраняет технологию', async ({ page }) => {
    await page.goto('/src/pages/radar.html');

    await page.waitForSelector('#techRadar', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#addTechBtn', { state: 'visible', timeout: 5000 });

    await page.click('#addTechBtn');

    const addPanel = page.locator('#addTechPanel');
    await expect(addPanel).toBeVisible({ timeout: 5000 });
    await expect(addPanel).toHaveClass(/open/);

    await page.waitForTimeout(600);

    const uniqueName = `E2E Test Tech ${Date.now()}`;
    await page.fill('#techName', uniqueName);

    await selectFirstOption(page, 'techDirections');
    await page.waitForTimeout(200);
    await selectFirstOption(page, 'techBlock');
    await page.waitForTimeout(200);
    await selectFirstOption(page, 'techFunc');
    await page.waitForTimeout(200);
    await selectFirstOption(page, 'techTrlStage');

    await page.click('#submitAddTech');

    await expect(addPanel).not.toBeVisible({ timeout: 10000 });
  });
});
