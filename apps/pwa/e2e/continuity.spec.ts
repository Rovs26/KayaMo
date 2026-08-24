import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Grove keeps Life Story empty copy and Settings exports stay free under Mus Lite', async ({ page }) => {
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
  await expect(page.getByText('Life Story')).toBeVisible();
  await expect(
    page.getByText('Nothing confirmed into the story yet. Completing or setting down a goal can be kept here.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Close this chapter/ })).toBeVisible();
  await expect(page.getByText('Not enough confirmed days yet for a pattern. That is allowed.')).toBeVisible();

  await page.getByRole('button', { name: /Close this chapter/ }).click();
  await expect(page.getByRole('heading', { name: 'Close this chapter' })).toBeVisible();
  await expect(page.getByText(/does not take anything away/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grove' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings and privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('How much to show · Mus Lite')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Life Archive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Evidence Bank' })).toBeVisible();
  await expect(page.getByText(/always free/i)).toBeVisible();

  await page.getByRole('button', { name: 'Simple' }).click();
  await expect(page.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Back to Grove' }).click();
  await expect(page.getByRole('heading', { name: 'Grove' })).toBeVisible();
  await expect(
    page.getByText('Nothing confirmed into the story yet. Completing or setting down a goal can be kept here.'),
  ).toBeVisible();
  await expect(page.getByText('From your records')).toHaveCount(0);
});
