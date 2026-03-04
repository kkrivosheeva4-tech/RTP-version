// @ts-check

const { expect } = require('@playwright/test');

async function complete2faIfNeeded(page) {
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
}

async function loginAsArchitect(page) {
  await page.goto('/src/pages/auth.html');
  await page.fill('#username', 'architect');
  await page.fill('#password', 'architect123');
  await page.click('#submitBtn');

  await complete2faIfNeeded(page);
  await expect(page).toHaveURL(/index\.html/);
}

module.exports = {
  loginAsArchitect,
};
