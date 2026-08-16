import { expect, test } from '@playwright/test';
import { createE2eServiceClient, e2eSupabaseConfigured, signInTestUser } from './helpers/auth';

test.describe('offline meal log', () => {
  test.skip(!e2eSupabaseConfigured(), 'Supabase env is not configured');

  test('logs a meal offline and syncs exactly once', async ({ page, context }) => {
    const user = await signInTestUser(page);
    const service = createE2eServiceClient();

    try {
      await expect(page.getByTestId('food-cache-ready')).toHaveAttribute('data-ready', '1', {
        timeout: 30_000,
      });

      let failedOnce = false;
      await page.route('**/rest/v1/food_entries*', async (route) => {
        const method = route.request().method();
        if (!failedOnce && (method === 'POST' || method === 'PATCH')) {
          failedOnce = true;
          await route.abort('failed');
          return;
        }
        await route.continue();
      });

      await context.setOffline(true);
      await page.getByTestId('log-meal').click();
      await expect(page.getByTestId('food-entry')).toHaveCount(1);
      await expect(page.getByTestId('sync-status')).toHaveAttribute('data-sync-kind', /offline|pending/);

      await context.setOffline(false);
      await expect(page.getByTestId('sync-status')).toHaveAttribute('data-sync-kind', 'synced', {
        timeout: 45_000,
      });
      await expect(page.getByTestId('food-entry')).toHaveCount(1);

      const { data, error } = await service
        .from('food_entries')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null);
      if (error) throw error;
      expect(data ?? []).toHaveLength(1);
    } finally {
      await service.from('food_entries').delete().eq('user_id', user.id);
      await service.auth.admin.deleteUser(user.id);
    }
  });
});
