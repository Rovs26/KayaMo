import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('first run asks who you are becoming before Home', async ({ page }) => {
  const statement = `Someone who keeps Sunday rest ${Date.now()}`;
  await page.addInitScript(() => {
    localStorage.setItem('kayamo:welcome-done', '1');
  });
  await page.goto('/login?account=1');
  await page.getByRole('button', { name: 'Skip login on this machine' }).click();
  await page.waitForURL('**/app', { timeout: 30_000 });

  await expect(page.getByRole('heading', { name: 'Who are you trying to become?' })).toBeVisible();
  await page.getByLabel('Your words').fill(statement);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What parts of life matter now?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /I don.t know yet/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'One useful first plan.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start with Mus' }).click();

  await expect(page.getByRole('heading', { name: 'Today with Mus' })).toBeVisible();
  await expect(page.getByText(statement)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' }).first()).toBeVisible();

  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => node.remove());
  });
  await page.getByRole('button', { name: 'Change' }).first().click();
  await expect(page.getByRole('heading', { name: 'Plan My Day' })).toBeVisible();
  await expect(page.getByText('Mus proposes from what is already on this device.')).toBeVisible();
});
