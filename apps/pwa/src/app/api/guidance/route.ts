import { NextResponse } from 'next/server';
import type { GuidanceSnapshot } from '@kayamo/core';
import {
  getLatestExpenditureEstimate,
  getProfile,
  listEffectiveNutritionTargets,
  type DbClient,
} from '@kayamo/db';
import { z } from 'zod';
import { refreshGuidance } from '@/lib/guidance-server';
import { createServerSupabase } from '@/lib/supabase/server';

const dateSchema = z.string().date();
const recomputeSchema = z
  .object({
    date: dateSchema,
    requestedWeeklyRatePercent: z.number().min(0).max(10).optional(),
    trainingDaysPerWeek: z.number().int().min(0).max(6).optional(),
  })
  .strict();

/** Fields the expenditure engine needs before it can produce an estimate. */
const REQUIRED_PROFILE_FIELDS = [
  'sex',
  'birth_year',
  'height_cm',
  'activity_baseline',
  'goal',
] as const;

async function readGuidance(
  client: DbClient,
  userId: string,
  date: string,
): Promise<GuidanceSnapshot> {
  const [profile, estimate, targets] = await Promise.all([
    getProfile(client, userId),
    getLatestExpenditureEstimate(client, { userId, throughDate: date }),
    listEffectiveNutritionTargets(client, { userId, date }),
  ]);
  return {
    date,
    profile: {
      complete: REQUIRED_PROFILE_FIELDS.every((field) => Boolean(profile?.[field])),
      missing: REQUIRED_PROFILE_FIELDS.filter((field) => !profile?.[field]),
      sex: profile?.sex ?? null,
      goal: profile?.goal ?? null,
      locale: profile?.locale ?? 'taglish',
      timezone: profile?.timezone ?? 'Asia/Manila',
      dayStartsAt: profile?.day_starts_at ?? '00:00:00',
    },
    expenditure: estimate
      ? {
          date: estimate.date,
          tdeeKcal: Number(estimate.tdee_kcal),
          ciLow: estimate.ci_low === null ? null : Number(estimate.ci_low),
          ciHigh: estimate.ci_high === null ? null : Number(estimate.ci_high),
          method: estimate.method,
          confidence: Number(estimate.confidence),
          daysOfData: estimate.days_of_data,
        }
      : null,
    targets: targets.map((target) => ({
      dayType: target.day_type,
      effectiveFrom: target.effective_from,
      kcal: Number(target.kcal),
      proteinG: Number(target.protein_g),
      carbsG: Number(target.carbs_g),
      fatG: Number(target.fat_g),
      clamped: target.clamped,
      clampReasons: target.clamp_reasons,
      weeklyRatePercent: Number(target.weekly_rate_percent),
      confidence: Number(target.confidence),
    })),
  };
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const url = new URL(request.url);
  const parsed = dateSchema.safeParse(
    url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid guidance date.' }, { status: 400 });
  }
  return NextResponse.json(await readGuidance(supabase, user.id, parsed.data));
}

/** Recomputes expenditure and targets, then returns the refreshed guidance. */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const parsed = recomputeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid recompute request.' }, { status: 400 });
  }

  const result = await refreshGuidance(supabase, user.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(await readGuidance(supabase, user.id, parsed.data.date));
}
