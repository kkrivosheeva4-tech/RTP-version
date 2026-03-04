// @ts-check
// E2E: Р”РѕР±Р°РІР»РµРЅРёРµ С‚РµС…РЅРѕР»РѕРіРёРё (mock API) вЂ” С€Р°Рі 10.5
// РџРѕР»РЅС‹Р№ СЃС†РµРЅР°СЂРёР№: РІСЃРµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ + РєРЅРѕРїРєР° В«Р”РѕР±Р°РІРёС‚СЊ С‚РµС…РЅРѕР»РѕРіРёСЋВ»

const { test, expect } = require('@playwright/test');
const { loginAsArchitect } = require('./helpers/auth');

const REQUIRED_FIELDS = [
  'techDirections',
  'techBlock',
  'techFunc',
  'techTrlStage',
];

async function openAddTechnologyPanel(page) {
  const addIconBtn = page.locator('#addIconBtn');
  await expect(addIconBtn).toBeVisible({ timeout: 15000 });
  await addIconBtn.click({ force: true });

  const chooseAddTech = page.locator('#chooseAddTech');
  await expect(chooseAddTech).toBeVisible({ timeout: 10000 });
  await chooseAddTech.click({ force: true });

  const addPanel = page.locator('#addTechPanel');
  await expect(addPanel).toBeVisible({ timeout: 15000 });
  await expect(addPanel).toHaveClass(/open/);
  return addPanel;
}

/**
 * Р’С‹Р±СЂР°С‚СЊ РїРµСЂРІСѓСЋ РѕРїС†РёСЋ РІ РєР°СЃС‚РѕРјРЅРѕРј СЃРµР»РµРєС‚Рµ.
 * РСЃРїРѕР»СЊР·СѓРµС‚ РєР»РёРє РїРѕ РѕРїС†РёРё вЂ” РЅР°РґС‘Р¶РЅРµРµ, С‡РµРј РєР»Р°РІРёР°С‚СѓСЂР°, РґР»СЏ РІСЃРµС… СЃРµР»РµРєС‚РѕРІ.
 */
async function selectFirstOption(page, dataField) {
  const select = page.locator(`#addTechPanel .custom-select-modal[data-field="${dataField}"]`);
  await expect(select).toBeVisible({ timeout: 10000 });
  const trigger = select.locator('.select-trigger');
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click({ force: true });
  await page.waitForTimeout(300);

  // Р–РґС‘Рј РїРѕСЏРІР»РµРЅРёСЏ РѕРїС†РёР№ Рё РєР»РёРєР°РµРј РїРµСЂРІСѓСЋ (TRL вЂ” РїСЂРѕСЃС‚С‹Рµ li, РѕСЃС‚Р°Р»СЊРЅС‹Рµ вЂ” select-option-item РёР»Рё li[data-value])
  const firstOption = select.locator(
    '.select-options li.select-option-item, .select-options li[data-value]:not([data-value=""])'
  ).first();
  await expect(firstOption).toBeVisible({ timeout: 10000 });
  await firstOption.click({ force: true });

  await page.waitForTimeout(200);
  // РЎРЅРёРјР°РµРј С„РѕРєСѓСЃ СЃ СЃРµР»РµРєС‚Р°, С‡С‚РѕР±С‹ tooltip/РІС‹РїР°РґР°СЋС‰РµРµ РјРµРЅСЋ РЅРµ РјРµС€Р°Р»Рё СЃР»РµРґСѓСЋС‰РёРј РґРµР№СЃС‚РІРёСЏРј
  await page.locator('#techName').click({ force: true });
  await page.waitForTimeout(200);
}

test.describe('Р”РѕР±Р°РІР»РµРЅРёРµ С‚РµС…РЅРѕР»РѕРіРёРё (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.API_BASE_URL = '';
      window.USE_API = false;
    });
    await loginAsArchitect(page);
  });

  test('РїРѕР»РЅС‹Р№ СЃС†РµРЅР°СЂРёР№: Р·Р°РїРѕР»РЅРµРЅРёРµ РІСЃРµС… РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РїРѕР»РµР№ Рё СЃРѕС…СЂР°РЅРµРЅРёРµ', async ({ page }) => {
    await page.goto('/src/pages/radar.html');

    await page.waitForSelector('#techRadar', { state: 'visible', timeout: 15000 });
    await page.locator('#filterPanel [data-filter="enterprise"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    const addPanel = await openAddTechnologyPanel(page);
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
    await descField.fill('E2E С‚РµСЃС‚РѕРІРѕРµ РѕРїРёСЃР°РЅРёРµ С‚РµС…РЅРѕР»РѕРіРёРё');
    await page.waitForTimeout(150);

    const holdingCheckbox = addPanel.locator('#techHoldingWide');
    await holdingCheckbox.scrollIntoViewIfNeeded();
    await holdingCheckbox.click({ force: true });
    await page.waitForTimeout(200);

    await expect(addPanel).toBeVisible();

    const submitBtn = page.locator('#submitAddTech');
    await expect(submitBtn).toBeEnabled({ timeout: 2000 });
    await submitBtn.click();

    await expect(submitBtn).toContainText(/Добавление/i, { timeout: 5000 });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });

    // Панель добавляния закрывается, появляется toast или уведомление
    await expect(page.getByText(/Технология добавлена|Добавлена технология|Технология успешно добавлена/i).first()).toBeVisible({ timeout: 15000 });
    await expect(addPanel).not.toBeVisible({ timeout: 15000 });
  });
});

