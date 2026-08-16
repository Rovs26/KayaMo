import { expect, test } from '@playwright/test';

test('home boots a blank page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeAttached();
});
