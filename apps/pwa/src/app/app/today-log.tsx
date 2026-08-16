'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import {
  getProfile,
  listServings,
  listVisibleFoods,
} from '@kayamo/db';
import type { Food, Serving } from '@kayamo/db';
import {
  cacheFoodWithServings,
  getOfflineDb,
  logFoodEntry,
  useLiveFoodEntries,
} from '@kayamo/offline';
import { Button, NumberDisplay } from '@kayamo/ui';
import { useEffect, useState } from 'react';

function scale(per100: string, grams: number): string {
  const value = Number(per100) * (grams / 100);
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 10_000) / 10_000);
}

function defaultServing(servings: Serving[]): Serving | undefined {
  return servings.find((row) => row.is_default) ?? servings[0];
}

export function TodayLog({ userId }: { userId: string }) {
  const [food, setFood] = useState<Food | null>(null);
  const [serving, setServing] = useState<Serving | null>(null);
  const [timeZone, setTimeZone] = useState('Asia/Manila');
  const [dayStartsAt, setDayStartsAt] = useState('00:00:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const entries = useLiveFoodEntries(userId, today);

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    let cancelled = false;

    async function hydrate() {
      try {
        const profile = await getProfile(client, userId);
        if (cancelled) return;
        if (profile?.timezone) setTimeZone(profile.timezone);
        if (profile?.day_starts_at) setDayStartsAt(profile.day_starts_at);

        const remoteFoods = await listVisibleFoods(client);
        for (const item of remoteFoods) {
          const servings = await listServings(client, item.id);
          await cacheFoodWithServings(item, servings);
        }
      } catch {
        // Offline: fall through to the Dexie cache.
      }

      const cachedFoods = await getOfflineDb().foods.toArray();
      const cached = cachedFoods
        .filter((item) => !item.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name))[0];
      if (!cached || cancelled) return;
      const cachedServings = await getOfflineDb().servings.where('food_id').equals(cached.id).toArray();
      setFood(cached);
      setServing(defaultServing(cachedServings) ?? null);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onLog() {
    if (!food || !serving) return;
    setBusy(true);
    setError(null);
    const grams = Number(serving.grams_equivalent);
    try {
      await logFoodEntry({
        userId,
        mealSlot: 'tanghalian',
        foodId: food.id,
        foodName: food.name,
        quantity: '1',
        grams: serving.grams_equivalent,
        kcal: scale(food.kcal, grams),
        protein_g: scale(food.protein_g, grams),
        carbs_g: scale(food.carbs_g, grams),
        fat_g: scale(food.fat_g, grams),
        fiber_g: scale(food.fiber_g, grams),
        sugar_g: scale(food.sugar_g, grams),
        sodium_mg: scale(food.sodium_mg, grams),
        source: food.source,
        resolvedVia: food.source,
        inputMethod: 'quick',
        servingId: serving.id,
        servingLabel: serving.label,
        timeZone,
        dayStartsAt,
      });
    } catch {
      setError('Could not save locally. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(food && serving);

  return (
    <section className="mt-8 flex flex-col gap-4">
      <div data-testid="food-cache-ready" data-ready={ready ? '1' : '0'} hidden>
        {ready ? 'ready' : 'loading'}
      </div>
      <Button
        type="button"
        size="lg"
        disabled={!ready || busy}
        onClick={() => void onLog()}
        data-testid="log-meal"
      >
        Log a meal
      </Button>
      {error ? <p className="font-body text-body text-warning">{error}</p> : null}
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            data-testid="food-entry"
            className="border-y border-line py-3"
          >
            <p className="font-body text-body">{entry.food_name_snapshot}</p>
            <NumberDisplay value={String(Math.round(Number(entry.kcal)))} unit="kcal" size="sm" />
          </li>
        ))}
      </ul>
    </section>
  );
}
