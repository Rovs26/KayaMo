import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('daily loop remains usable at mobile width and resumes through the offline shell', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kayamo:last-user-id', 'e2e-local-user');
  });
  await page.goto('/offline/app');
  await expect(page.getByRole('heading', { name: 'Today with Coco' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Faith reflection' })).toHaveCount(0);
  await page.getByLabel('What is the one action that would help today?').fill('Read one page');
  await page.getByRole('button', { name: 'Choose this action' }).click();
  await expect(page.getByText('Read one page')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);

  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByText('Read one page')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Today with Coco' })).toBeVisible();
  await expect(page.getByText('Offline · changes stay on this device until sync returns')).toBeVisible();
  const savedPlans = await page.evaluate(async () => {
    const request = indexedDB.open('kayamo');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('daily_plans', 'readonly');
    const rows = transaction.objectStore('daily_plans').getAll();
    return new Promise<unknown[]>((resolve, reject) => {
      rows.onsuccess = () => resolve(rows.result);
      rows.onerror = () => reject(rows.error);
    });
  });
  expect(savedPlans).toHaveLength(1);
  await expect(page.getByText('Read one page')).toBeVisible();
});
