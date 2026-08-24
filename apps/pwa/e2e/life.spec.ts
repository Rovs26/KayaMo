import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Life opens as an area hub and Physical Self holds food and gym', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kayamo:welcome-done', '1');
    localStorage.setItem('kayamo:first-run-done', '1');
  });
  await page.goto('/login?account=1');
  await page.getByRole('button', { name: 'Skip login on this machine' }).click();
  await page.waitForURL('**/app', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Today with Mus' })).toBeVisible();

  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => node.remove());
  });
  await page.getByRole('button', { name: 'Life' }).click();
  await expect(page.getByRole('heading', { name: 'Life' })).toBeVisible();
  await expect(page.getByText('Mind & Learning')).toBeVisible();
  await page.getByRole('button', { name: /Physical Self/ }).click();
  await expect(page.getByRole('heading', { name: 'Physical Self' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log food' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await expect(page.getByText('Mind & Learning')).toHaveCount(0);

  await page.getByRole('button', { name: 'Life areas' }).click();
  await expect(page.getByRole('heading', { name: 'Life' })).toBeVisible();
  await expect(page.getByText('Mind & Learning')).toBeVisible();
});
