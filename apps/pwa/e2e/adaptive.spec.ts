import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Weekly Reset shows local records without dumping forgotten work onto today', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Grove' }).click();
  await expect(page.getByRole('heading', { name: 'Grove' })).toBeVisible();
  await expect(page.getByText('Not enough confirmed days yet for a pattern. That is allowed.')).toBeVisible();

  await page.getByRole('button', { name: /Weekly Reset/ }).click();
  await expect(page.getByRole('heading', { name: 'Weekly Reset' })).toBeVisible();
  await expect(page.getByText('Forgotten · still not dumped onto today')).toBeVisible();
  await expect(page.getByText('Nothing sitting idle from earlier.')).toBeVisible();
});
