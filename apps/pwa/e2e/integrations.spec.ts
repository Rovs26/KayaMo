import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Settings shows integrations as disconnected and Home keeps a manual calendar alternative', async ({ page }) => {
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
  await expect(page.getByText('Already committed · not a calendar sync')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add hours' })).toBeVisible();

  await page.getByRole('button', { name: 'Grove' }).click();
  await page.getByRole('button', { name: 'Settings and privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('What Mus can do')).toBeVisible();
  await expect(page.getByRole('button', { name: /Calendar/ })).toContainText('Not connected');
  await expect(page.getByRole('button', { name: /Health apps/ })).toContainText('Not connected');
  await expect(page.getByText(/nothing here is faked/i)).toBeVisible();
});
