import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('writing a goal myself saves it and shows it on Home', async ({ page }) => {
  const title = `Find work that does not drain me ${Date.now()}`;
  await page.addInitScript(() => {
    localStorage.setItem('kayamo:welcome-done', '1');
    localStorage.setItem('kayamo:first-run-done', '1');
  });
  await page.goto('/login?account=1');
  await page.getByRole('button', { name: 'Skip login on this machine' }).click();
  await page.waitForURL('**/app', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Today with Mus' })).toBeVisible();

  await page.getByRole('button', { name: 'Goals' }).click();
  await page.getByRole('button', { name: 'Add' }).filter({ hasText: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'What are you working toward?' })).toBeVisible();
  await page.getByRole('button', { name: 'Write it myself' }).click();
  await page.getByLabel('The goal').fill(title);
  await page.getByLabel('Why it matters').fill('Ayoko nang gisingin ng takot tuwing Lunes.');
  await page.getByLabel('What done looks like').fill('A signed offer, day shift.');
  await page.getByLabel('First step, today-sized').fill('List five places I would actually work at.');
  await page.getByRole('button', { name: 'Make this my goal' }).click();

  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Goals' }).click();
  await expect(page.getByText(title)).toBeVisible();

  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => node.remove());
  });
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByText('Working toward')).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByRole('button', { name: 'List five places I would actually work at.' })).toBeVisible();
});
