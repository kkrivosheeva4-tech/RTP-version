// @ts-check
// E2E: Добавление технологии (mock API) — шаг 10.5
// Полный сценарий: все обязательные поля + кнопка «Добавить технологию»

const { test, expect } = require('@playwright/test');

const REQUIRED_FIELDS = [
  'techDirections',
  'techBlock',
  'techFunc',
  'techTrlStage',
];

/**
 * Выбрать первую опцию в кастомном селекте.
 * Использует клик по опции — надёжнее, чем клавиатура, для всех селектов.
 */
async function selectFirstOption(page, dataField) {
  const select = page.locator(`#addTechPanel .custom-select-modal[data-field="${dataField}"]`);
  await select.waitFor({ state: 'visible', timeout: 5000 });
  const trigger = select.locator('.select-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click({ force: true });
  await page.waitForTimeout(400);

  // Ждём появления опций и кликаем первую (TRL — простые li, остальные — select-option-item или li[data-value])
  const firstOption = select.locator(
    '.select-options li.select-option-item, .select-options li[data-value]:not([data-value=""])'
  ).first();
  await firstOption.waitFor({ state: 'visible', timeout: 5000 });
  await firstOption.scrollIntoViewIfNeeded();
  await firstOption.click({ force: true });

  await page.waitForTimeout(200);
  // Снимаем фокус с селекта, чтобы tooltip/выпадающее меню не мешали следующим действиям
  await page.locator('#techName').click({ force: true });
  await page.waitForTimeout(200);
}

test.describe('Добавление технологии (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/pages/auth.html');
    await page.fill('#username', 'architect');
    await page.fill('#password', 'architect123');
    await page.click('#submitBtn');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('полный сценарий: заполнение всех обязательных полей и сохранение', async ({ page }) => {
    await page.goto('/src/pages/radar.html');

    await page.waitForSelector('#techRadar', { state: 'visible', timeout: 15000 });
    await page.locator('#filterPanel [data-filter="enterprise"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    const addIconBtn = page.getByRole('button', { name: 'Добавить' });
    await addIconBtn.waitFor({ state: 'visible', timeout: 5000 });
    await addIconBtn.click();
    await page.waitForTimeout(300);

    const chooseAddTech = page.getByRole('button', { name: /Добавить новую технологию/i });
    await chooseAddTech.waitFor({ state: 'visible', timeout: 5000 });
    await chooseAddTech.click();

    const addPanel = page.locator('#addTechPanel');
    await expect(addPanel).toBeVisible({ timeout: 15000 });
    await expect(addPanel).toHaveClass(/open/);
    await addPanel.locator('#techName').waitFor({ state: 'visible', timeout: 10000 });
    await addPanel.locator('.custom-select-modal[data-field="techDirections"] .select-options li').first().waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);

    const uniqueName = `E2E Test Tech ${Date.now()}`;

    await page.fill('#techName', uniqueName);
    await page.waitForTimeout(200);

    for (const field of REQUIRED_FIELDS) {
      await selectFirstOption(page, field);
      await page.waitForTimeout(300);
    }

    const descField = addPanel.locator('#techDesc');
    await descField.scrollIntoViewIfNeeded();
    await descField.click();
    await descField.fill('E2E тестовое описание технологии');
    await page.waitForTimeout(150);

    const holdingCheckbox = addPanel.locator('#techHoldingWide');
    await holdingCheckbox.scrollIntoViewIfNeeded();
    await holdingCheckbox.click({ force: true });
    await page.waitForTimeout(200);

    await expect(addPanel).toBeVisible();

    const submitBtn = page.locator('#submitAddTech');
    await expect(submitBtn).toBeEnabled({ timeout: 2000 });
    await submitBtn.click();

    // Панель добавляния закрывается, появляется toast или уведомление
    await expect(page.locator('#addTechPanel')).not.toHaveClass(/open/, { timeout: 5000 });
    await expect(page.getByText(/Технология добавлена|Добавлена технология|Технология успешно добавлена/i).first()).toBeVisible({ timeout: 10000 });
  });
});
