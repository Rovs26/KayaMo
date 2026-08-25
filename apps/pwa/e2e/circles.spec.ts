import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Circles stay optional with social off and never invent a feed', async ({ page }) => {
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
  await page.getByRole('button', { name: /Circles/ }).click();
  await expect(page.getByRole('heading', { name: 'Circles' })).toBeVisible();
  await expect(page.getByText('off · nothing is published')).toBeVisible();
  await expect(page.getByText(/no feed and no follower count/i)).toBeVisible();

  await page.getByPlaceholder('Gym friends, thesis group').fill('Gym friends');
  await page.getByRole('button', { name: 'Keep on this device' }).click();
  await expect(page.getByText('What Gym friends would see')).toBeVisible();
  await expect(page.getByText('Never included')).toBeVisible();
  await expect(page.getByText(/Calories and macros/)).toBeVisible();
  await expect(page.getByText(/Social is off/)).toBeVisible();
});
